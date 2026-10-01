import io,uuid,base64
from decimal import Decimal
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter,Depends,HTTPException,UploadFile,File,Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session,joinedload,selectinload
from sqlalchemy import or_
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
from app.db.session import get_db
from app.models.order import Order,OrderItem,OrderPayment
from app.models.customer import Customer
from app.models.product import Product
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.schemas.order import OrderCreate,OrderUpdate,ItemCreate,ItemStatusUpdate,PaymentCreate,OrderOut
from app.schemas.audit import AuditOut
from app.core.security import current_user
from app.services.storage import upload,presigned,safe_filename
from app.services.audit import record_audit
from app.services.inventory import locked_product,reserve_product,release_product,record_transaction,stock_amount
from app.tasks.celery_app import send_whatsapp_task as _send_whatsapp_task
from typing import Any
# celery's decorator typing doesn't expose .delay to type checkers; the runtime
# object is a Task proxy, so the queued calls below are safe.
send_whatsapp_task:Any=_send_whatsapp_task
import qrcode
router=APIRouter(prefix='/orders',tags=['orders'])
ITEM_STATUSES={'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','DELIVERED','ON_HOLD','CANCELLED'}
ORDER_STATUSES={'OPEN','IN_PROGRESS','PARTIALLY_READY','READY','DELIVERED','CANCELLED'}
# Active items share one workshop status menu. DELIVERY remains available only
# from READY because it consumes reserved inventory; terminal states stay final.
ORDER_TRANSITIONS={
    'OPEN':{'IN_PROGRESS','READY','DELIVERED','CANCELLED'},
    'IN_PROGRESS':{'PARTIALLY_READY','READY','DELIVERED','CANCELLED'},
    'PARTIALLY_READY':{'READY','IN_PROGRESS','DELIVERED','CANCELLED'},
    'READY':{'DELIVERED','IN_PROGRESS','PARTIALLY_READY','CANCELLED'},
    'DELIVERED':set(),
    'CANCELLED':set(),
}
ITEM_TRANSITIONS={
    'ORDER_CREATED':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED'},
    'SENT_TO_WORKSHOP':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED'},
    'IN_PROGRESS':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED'},
    'QUALITY_CHECK':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED'},
    'REWORK_REQUIRED':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED'},
    'READY':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED','DELIVERED'},
    'ON_HOLD':{'ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','ON_HOLD','CANCELLED'},
    'DELIVERED':set(),
    'CANCELLED':set(),
}
def recompute_order_status(order:Order):
    items=order.items
    if not items: return 'OPEN'
    if all(x.status=='DELIVERED' for x in items): return 'DELIVERED'
    if all(x.status in {'READY','DELIVERED'} for x in items): return 'READY'
    if all(x.status in {'DELIVERED','CANCELLED'} for x in items): return 'DELIVERED' if any(x.status=='DELIVERED' for x in items) else 'CANCELLED'
    return 'PARTIALLY_READY' if any(x.status in {'READY','DELIVERED'} for x in items) else 'IN_PROGRESS'
def load_order(db:Session,order_id:int)->Order|None:
    return db.query(Order).options(joinedload(Order.items),joinedload(Order.customer),selectinload(Order.payments)).filter(Order.id==order_id).first()
def issue_invoice_if_delivered(order:Order):
    if order.status=='DELIVERED' and not order.invoice_issued_at:
        order.invoice_number=order.invoice_number or f'INV-{order.order_number}'
        order.invoice_issued_at=datetime.now(timezone.utc)
def local_datetime(value:datetime|None):
    return value.astimezone(ZoneInfo('Asia/Kolkata')) if value and value.tzinfo else value
def maybe_queue_ready_notification(db:Session,item:OrderItem):
    # Idempotent: only queue when the customer opted in and no live
    # notification exists for this item already.
    if db.query(Notification).filter(Notification.order_item_id==item.id,Notification.status.in_({'QUEUED','SENT'})).first(): return
    customer=db.get(Customer,item.order.customer_id)
    if not customer or not customer.whatsapp_opt_in: return
    n=Notification(customer_id=customer.id,order_id=item.order_id,order_item_id=item.id,channel='WHATSAPP',type='ORDER_READY',status='QUEUED')
    db.add(n); db.flush(); send_whatsapp_task.delay(n.id)
def apply_item_data(item:OrderItem,data:ItemCreate):
    for key,value in data.model_dump(exclude={'product_id'}).items():
        setattr(item,key,value)
@router.get('',response_model=list[OrderOut],summary='List orders with search (order number/customer/phone), status and date filters, sorting and pagination')
def list_orders(response:Response,status:str|None=None,customer_id:int|None=None,q:str|None=None,created_from:str|None=None,created_to:str|None=None,expected_from:str|None=None,expected_to:str|None=None,sort:str='id_desc',skip:int=0,limit:int=50,db:Session=Depends(get_db),_=Depends(current_user)):
    query=db.query(Order).join(Customer,Order.customer_id==Customer.id).options(joinedload(Order.items),joinedload(Order.customer),selectinload(Order.payments))
    if status: query=query.filter(Order.status==status.upper())
    if customer_id: query=query.filter(Order.customer_id==customer_id)
    if q: query=query.filter(or_(Order.order_number.ilike(f'%{q}%'),Customer.name.ilike(f'%{q}%'),Customer.phone.ilike(f'%{q}%')))
    try:
        if created_from: query=query.filter(Order.created_at>=datetime.fromisoformat(created_from))
        if created_to: query=query.filter(Order.created_at<=datetime.fromisoformat(created_to))
        if expected_from: query=query.filter(Order.expected_delivery_date>=datetime.fromisoformat(expected_from).date())
        if expected_to: query=query.filter(Order.expected_delivery_date<=datetime.fromisoformat(expected_to).date())
    except ValueError: raise HTTPException(400,'Invalid date filter, use ISO format YYYY-MM-DD')
    order_map={'id_desc':Order.id.desc(),'id_asc':Order.id.asc(),'created_desc':Order.created_at.desc(),'created_asc':Order.created_at.asc()}
    query=query.order_by(order_map.get(sort,Order.id.desc()))
    total=query.count()
    response.headers['X-Total-Count']=str(total)
    return query.offset(skip).limit(min(limit,200)).all()
@router.post('',response_model=OrderOut,summary='Create an order with optional jewellery items (reserves stock in one transaction)')
def create_order(data:OrderCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    if not db.get(Customer,data.customer_id): raise HTTPException(404,'Customer not found')
    o=Order(order_number=f"ANJ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",customer_id=data.customer_id,expected_delivery_date=data.expected_delivery_date,notes=data.notes,status='OPEN')
    db.add(o); db.flush()
    for payload in data.items:
        item=OrderItem(order_id=o.id,item_code=f"{o.order_number}-ITEM-{uuid.uuid4().hex[:5].upper()}",status='ORDER_CREATED')
        apply_item_data(item,payload)
        if payload.product_id:
            p=locked_product(db,payload.product_id)
            if not p: raise HTTPException(404,f'Product {payload.product_id} not found')
            item.product_id=p.id
        db.add(item); db.flush()
        if item.product_id:
            amount=stock_amount(item,p)
            reserve_product(p,amount)
            record_transaction(db,p,'RESERVE',reserved_delta=amount,reference=o.order_number,reason=f'Reserved for {item.item_code}',order_id=o.id,order_item_id=item.id,user_id=_.id)
    db.flush()
    o.status=recompute_order_status(o)
    record_audit(db,'order_created','order',o.id,user_id=_.id,order_id=o.id,meta={'order_number':o.order_number,'items':len(data.items)})
    db.commit()
    return load_order(db,o.id)
@router.get('/{order_id}',response_model=OrderOut,summary='Get a single order with customer and items')
def get_order(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    return o
@router.post('/{order_id}/payments',response_model=OrderOut,summary='Record an advance or balance payment for an order')
def create_payment(order_id:int,data:PaymentCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    locked_order=db.query(Order).filter(Order.id==order_id).with_for_update().first()
    if not locked_order: raise HTTPException(404,'Order not found')
    order=load_order(db,order_id)
    if not order: raise HTTPException(404,'Order not found')
    if order.status=='CANCELLED': raise HTTPException(409,'Payments cannot be recorded on a cancelled order.')
    total=sum((Decimal(str(item.estimated_value or 0)) for item in order.items),Decimal('0.00'))
    paid=sum((Decimal(str(payment.amount or 0)) for payment in order.payments),Decimal('0.00'))
    if total<=0: raise HTTPException(409,'Add an estimated value to the order before recording a payment.')
    balance=max(Decimal('0.00'),total-paid)
    if data.amount>balance: raise HTTPException(409,f'Payment exceeds the remaining balance of INR {balance:.2f}.')
    payment=OrderPayment(order_id=order.id,amount=data.amount,method=data.method,reference=(data.reference or '').strip() or None,note=(data.note or '').strip() or None,received_by=_.id)
    db.add(payment);db.flush()
    record_audit(db,'payment_recorded','payment',payment.id,user_id=_.id,order_id=order.id,meta={'amount':str(data.amount),'method':data.method,'reference':payment.reference})
    db.commit()
    return load_order(db,order.id)
@router.get('/{order_id}/invoice',summary='Download the final invoice PDF for a delivered order')
def download_invoice(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    order=load_order(db,order_id)
    if not order: raise HTTPException(404,'Order not found')
    if order.status!='DELIVERED': raise HTTPException(409,'The final invoice is available after the order is delivered.')
    issue_invoice_if_delivered(order)
    db.commit()
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='InvoiceTitle',parent=styles['Title'],fontName='Helvetica-Bold',fontSize=21,textColor=colors.HexColor('#172c3d'),alignment=0,spaceAfter=3))
    styles.add(ParagraphStyle(name='InvoiceSmall',parent=styles['BodyText'],fontSize=8,textColor=colors.HexColor('#526273'),leading=11))
    styles.add(ParagraphStyle(name='InvoiceRight',parent=styles['BodyText'],alignment=TA_RIGHT,fontSize=9))
    styles.add(ParagraphStyle(name='InvoiceCell',parent=styles['BodyText'],fontSize=8,leading=10,wordWrap='CJK'))
    story=[Paragraph('ANAND JEWELLERS',styles['Heading2']),Paragraph('FINAL ORDER INVOICE',styles['InvoiceTitle']),Spacer(1,3*mm)]
    issued=local_datetime(order.invoice_issued_at);created=local_datetime(order.created_at)
    story.append(Paragraph(f"Invoice: <b>{escape(order.invoice_number or '')}</b> &nbsp;&nbsp; Issued: {issued.strftime('%d %b %Y') if issued else ''}",styles['BodyText']))
    story.append(Paragraph(f"Order: <b>{escape(order.order_number)}</b> &nbsp;&nbsp; Order date: {created.strftime('%d %b %Y') if created else ''}",styles['BodyText']))
    story.append(Spacer(1,4*mm))
    customer=order.customer
    customer_lines=[f"<b>Bill to:</b> {escape(customer.name if customer else 'Customer')}"]
    if customer and customer.phone: customer_lines.append(f"Phone: {escape(customer.phone)}")
    if customer and customer.email: customer_lines.append(f"Email: {escape(customer.email)}")
    if customer and customer.address: customer_lines.append(escape(customer.address))
    story.append(Paragraph('<br/>'.join(customer_lines),styles['BodyText']));story.append(Spacer(1,5*mm))
    rows=[[Paragraph('<b>Item</b>',styles['InvoiceCell']),Paragraph('<b>Design / details</b>',styles['InvoiceCell']),Paragraph('<b>Purity / weight</b>',styles['InvoiceCell']),Paragraph('<b>Qty</b>',styles['InvoiceCell']),Paragraph('<b>Estimate (INR)</b>',styles['InvoiceCell'])]]
    for item in order.items:
        description=' · '.join(value for value in [item.design,item.description] if value) or '—'
        purity_weight=' · '.join(value for value in [item.gold_purity,(f'{item.net_weight_g} g' if item.net_weight_g is not None else None)] if value) or '—'
        rows.append([Paragraph(escape(item.item_type),styles['InvoiceCell']),Paragraph(escape(description),styles['InvoiceCell']),Paragraph(escape(purity_weight),styles['InvoiceCell']),str(item.quantity),f"{Decimal(str(item.estimated_value or 0)):,.2f}"])
    table=Table(rows,colWidths=[25*mm,65*mm,34*mm,16*mm,40*mm],repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#172c3d')),('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('GRID',(0,0),(-1,-1),.35,colors.HexColor('#ccd4dc')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f4f6f8')]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(3,1),(-1,-1),'RIGHT'),('FONTSIZE',(0,0),(-1,-1),8),
        ('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
    ]))
    story.extend([table,Spacer(1,5*mm)])
    total=sum((Decimal(str(item.estimated_value or 0)) for item in order.items),Decimal('0.00'))
    paid=sum((Decimal(str(payment.amount or 0)) for payment in order.payments),Decimal('0.00'))
    balance=max(Decimal('0.00'),total-paid)
    totals=[[Paragraph('Estimated order total',styles['BodyText']),f'INR {total:,.2f}'],[Paragraph('Payments received',styles['BodyText']),f'INR {paid:,.2f}'],[Paragraph('<b>Balance due</b>',styles['BodyText']),Paragraph(f'<b>INR {balance:,.2f}</b>',styles['InvoiceRight'])]]
    totals_table=Table(totals,colWidths=[135*mm,45*mm],hAlign='RIGHT')
    totals_table.setStyle(TableStyle([('ALIGN',(1,0),(1,-1),'RIGHT'),('LINEABOVE',(0,2),(-1,2),.8,colors.HexColor('#172c3d')),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    story.extend([totals_table,Spacer(1,5*mm),Paragraph('<b>Payment history</b>',styles['Heading3'])])
    if order.payments:
        payment_rows=[[Paragraph('<b>Date</b>',styles['InvoiceCell']),Paragraph('<b>Method</b>',styles['InvoiceCell']),Paragraph('<b>Reference</b>',styles['InvoiceCell']),Paragraph('<b>Note</b>',styles['InvoiceCell']),Paragraph('<b>Amount (INR)</b>',styles['InvoiceCell'])]]
        for payment in order.payments:
            paid_at=local_datetime(payment.paid_at)
            payment_rows.append([paid_at.strftime('%d %b %Y') if paid_at else '—',payment.method.replace('_',' ').title(),Paragraph(escape(payment.reference or '—'),styles['InvoiceCell']),Paragraph(escape(payment.note or '—'),styles['InvoiceCell']),f'{Decimal(str(payment.amount)):,.2f}'])
        payment_table=Table(payment_rows,colWidths=[30*mm,30*mm,40*mm,40*mm,40*mm],repeatRows=1)
        payment_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8edf2')),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#ccd4dc')),('ALIGN',(-1,1),(-1,-1),'RIGHT'),('FONTSIZE',(0,0),(-1,-1),8),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        story.append(payment_table)
    else:
        story.append(Paragraph('No payments have been recorded.',styles['InvoiceSmall']))
    story.extend([Spacer(1,7*mm),Paragraph('Amounts shown are based on the estimates saved to this order. Thank you for choosing Anand Jewellers.',styles['InvoiceSmall'])])
    buffer=io.BytesIO()
    document=SimpleDocTemplate(buffer,pagesize=A4,rightMargin=15*mm,leftMargin=15*mm,topMargin=15*mm,bottomMargin=15*mm,title=f'Invoice {order.invoice_number}')
    document.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="{order.invoice_number}.pdf"'})
@router.get('/{order_id}/payments/{payment_id}/receipt',summary='Download a PDF receipt for a recorded payment')
def download_payment_receipt(order_id:int,payment_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    order=load_order(db,order_id)
    if not order: raise HTTPException(404,'Order not found')
    payment=next((entry for entry in order.payments if entry.id==payment_id),None)
    if not payment: raise HTTPException(404,'Payment not found for this order')
    payments=sorted(order.payments,key=lambda entry:(entry.paid_at,entry.id))
    paid_through_receipt=Decimal('0.00')
    for entry in payments:
        paid_through_receipt+=Decimal(str(entry.amount))
        if entry.id==payment.id: break
    estimate=sum((Decimal(str(item.estimated_value or 0)) for item in order.items),Decimal('0.00'))
    balance=max(Decimal('0.00'),estimate-paid_through_receipt)
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ReceiptTitle',parent=styles['Title'],fontName='Helvetica-Bold',fontSize=20,textColor=colors.HexColor('#172c3d'),spaceAfter=5))
    styles.add(ParagraphStyle(name='ReceiptSmall',parent=styles['BodyText'],fontSize=9,textColor=colors.HexColor('#526273'),leading=13))
    styles.add(ParagraphStyle(name='ReceiptRight',parent=styles['BodyText'],alignment=TA_RIGHT,fontSize=10))
    styles.add(ParagraphStyle(name='ReceiptMethod',parent=styles['BodyText'],textColor=colors.HexColor('#173a54'),fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='ReceiptCell',parent=styles['BodyText'],fontSize=8,leading=10,wordWrap='CJK'))
    story=[Paragraph('ANAND JEWELLERS',styles['Heading2']),Paragraph('PAYMENT RECEIPT',styles['ReceiptTitle'])]
    paid_at=local_datetime(payment.paid_at)
    receipt_number=f'RCP-{payment.id:06d}'
    story.append(Paragraph(f"Receipt: <b>{receipt_number}</b> &nbsp;&nbsp; Date: {paid_at.strftime('%d %b %Y, %I:%M %p') if paid_at else ''}",styles['BodyText']))
    story.append(Paragraph(f"Order: <b>{escape(order.order_number)}</b>",styles['BodyText']))
    customer=order.customer
    story.append(Spacer(1,4*mm))
    story.append(Paragraph(f"Received from: <b>{escape(customer.name if customer else 'Customer')}</b><br/>Phone: {escape(customer.phone if customer and customer.phone else '—')}",styles['BodyText']))
    story.append(Spacer(1,5*mm))
    story.append(Paragraph('<b>Order items and estimates</b>',styles['Heading3']))
    item_rows=[[Paragraph('<b>Item</b>',styles['ReceiptCell']),Paragraph('<b>Design / details</b>',styles['ReceiptCell']),Paragraph('<b>Purity / weight</b>',styles['ReceiptCell']),Paragraph('<b>Qty</b>',styles['ReceiptCell']),Paragraph('<b>Estimate (INR)</b>',styles['ReceiptCell'])]]
    for item in order.items:
        description=' · '.join(value for value in [item.design,item.description] if value) or '—'
        purity_weight=' · '.join(value for value in [item.gold_purity,(f'{item.net_weight_g} g' if item.net_weight_g is not None else None)] if value) or '—'
        item_rows.append([Paragraph(escape(item.item_type),styles['ReceiptCell']),Paragraph(escape(description),styles['ReceiptCell']),Paragraph(escape(purity_weight),styles['ReceiptCell']),str(item.quantity),f"{Decimal(str(item.estimated_value or 0)):,.2f}"])
    item_table=Table(item_rows,colWidths=[25*mm,65*mm,34*mm,16*mm,40*mm],repeatRows=1,hAlign='LEFT')
    item_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#172c3d')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#ccd4dc')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f4f6f8')]),('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(3,1),(-1,-1),'RIGHT'),('FONTSIZE',(0,0),(-1,-1),8),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story.extend([item_table,Spacer(1,5*mm)])
    rows=[
        [Paragraph('<b>Amount received</b>',styles['BodyText']),Paragraph(f'<b>INR {Decimal(str(payment.amount)):,.2f}</b>',styles['ReceiptRight'])],
        [Paragraph('<b>Payment method</b>',styles['ReceiptMethod']),Paragraph(escape(payment.method.replace('_',' ').title()),styles['ReceiptMethod'])],
        [Paragraph('Transaction / receipt reference',styles['BodyText']),escape(payment.reference or '—')],
        [Paragraph('Payment note',styles['BodyText']),escape(payment.note or '—')],
        [Paragraph('Order estimate',styles['BodyText']),f'INR {estimate:,.2f}'],
        [Paragraph('Total paid through this receipt',styles['BodyText']),f'INR {paid_through_receipt:,.2f}'],
        [Paragraph('<b>Balance remaining after this payment</b>',styles['BodyText']),Paragraph(f'<b>INR {balance:,.2f}</b>',styles['ReceiptRight'])],
    ]
    receipt_table=Table(rows,colWidths=[105*mm,75*mm],hAlign='LEFT')
    receipt_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#f0f3f6')),('BACKGROUND',(0,1),(-1,1),colors.HexColor('#edf7fc')),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#ccd4dc')),('ALIGN',(1,0),(1,-1),'RIGHT'),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEABOVE',(0,-1),(-1,-1),.8,colors.HexColor('#172c3d')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story.extend([receipt_table,Spacer(1,8*mm),Paragraph('Thank you for your payment. This receipt records the amount received by Anand Jewellers.',styles['ReceiptSmall'])])
    buffer=io.BytesIO()
    SimpleDocTemplate(buffer,pagesize=A4,rightMargin=15*mm,leftMargin=15*mm,topMargin=18*mm,bottomMargin=18*mm,title=f'Payment receipt {receipt_number}').build(story)
    buffer.seek(0)
    return StreamingResponse(buffer,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="{receipt_number}.pdf"'})
@router.get('/{order_id}/timeline',response_model=list[AuditOut],summary='Audit-based status timeline for an order and its items')
def order_timeline(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    if not load_order(db,order_id): raise HTTPException(404,'Order not found')
    return db.query(AuditLog).filter(AuditLog.order_id==order_id).order_by(AuditLog.created_at.asc(),AuditLog.id.asc()).limit(200).all()
@router.patch('/{order_id}',response_model=OrderOut,summary='Update an order (status transitions are validated)')
def update_order(order_id:int,data:OrderUpdate,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    update=data.model_dump(exclude_unset=True)
    if 'status' in update:
        target=update.pop('status')
        if target not in ORDER_STATUSES: raise HTTPException(400,'Invalid status')
        if target not in ORDER_TRANSITIONS[o.status]: raise HTTPException(400,f'Invalid status transition from {o.status} to {target}')
        record_audit(db,'order_status_changed','order',o.id,user_id=_.id,order_id=o.id,meta={'from':o.status,'to':target})
        if target=='DELIVERED' and any(item.status not in {'DELIVERED','CANCELLED'} for item in o.items):
            raise HTTPException(409,'Mark each order item delivered or cancelled before completing the order.')
        if target=='CANCELLED':
            for item in o.items:
                if item.status in {'DELIVERED','CANCELLED'}: continue
                previous=item.status
                if item.product_id:
                    product=locked_product(db,item.product_id)
                    if product:
                        amount=stock_amount(item,product)
                        release_product(product,amount)
                        record_transaction(db,product,'RELEASE',reserved_delta=-amount,reference=o.order_number,reason=f'Released for cancelled order item {item.item_code}',order_id=o.id,order_item_id=item.id,user_id=_.id)
                item.status='CANCELLED'; item.cancellation_reason='Order cancelled by staff'
                record_audit(db,'item_status_changed','order_item',item.id,user_id=_.id,order_id=o.id,meta={'from':previous,'to':'CANCELLED','reason':item.cancellation_reason})
        o.status=target
        issue_invoice_if_delivered(o)
    for k,v in update.items(): setattr(o,k,v)
    if update: record_audit(db,'order_updated','order',o.id,user_id=_.id,order_id=o.id,meta={'fields':list(update.keys())})
    db.commit(); db.refresh(o); return load_order(db,order_id)
@router.delete('/{order_id}',summary='Delete an order and release any reservations')
def delete_order(order_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    for item in o.items:
        if item.product_id and item.status not in {'DELIVERED','CANCELLED'}:
            p=locked_product(db,item.product_id)
            if p:
                amount=stock_amount(item,p)
                release_product(p,amount)
                record_transaction(db,p,'RELEASE',reserved_delta=-amount,reference=o.order_number,reason=f'Released when order {o.order_number} was deleted',order_id=o.id,order_item_id=item.id,user_id=_.id)
    record_audit(db,'order_deleted','order',o.id,user_id=_.id,order_id=None,meta={'order_number':o.order_number})
    db.delete(o); db.commit()
    return {'id':order_id,'deleted':True}
@router.post('/{order_id}/items',response_model=OrderOut,summary='Add a jewellery item to an order (reserves inventory stock)')
def add_item(order_id:int,data:ItemCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    o=load_order(db,order_id)
    if not o: raise HTTPException(404,'Order not found')
    item=OrderItem(order_id=order_id,item_code=f"{o.order_number}-ITEM-{uuid.uuid4().hex[:5].upper()}",status='ORDER_CREATED')
    apply_item_data(item,data)
    if data.product_id:
        p=locked_product(db,data.product_id)
        if not p: raise HTTPException(404,'Product not found')
        item.product_id=p.id
    db.add(item); db.flush()
    if item.product_id:
        amount=stock_amount(item,p)
        reserve_product(p,amount)
        record_transaction(db,p,'RESERVE',reserved_delta=amount,reference=o.order_number,reason=f'Reserved for {item.item_code}',order_id=o.id,order_item_id=item.id,user_id=_.id)
    db.expire(o,['items'])
    o.status=recompute_order_status(o)
    record_audit(db,'item_created','order_item',item.id,user_id=_.id,order_id=order_id,meta={'item_type':data.item_type,'quantity':data.quantity,'product_id':data.product_id})
    db.commit()
    return load_order(db,order_id)
@router.patch('/items/{item_id}',response_model=OrderOut,summary='Update a jewellery item (handles reservation changes)')
def update_item(item_id:int,data:ItemCreate,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    if item.order.invoice_number: raise HTTPException(409,'Items on an invoiced order cannot be changed.')
    active=item.status not in {'DELIVERED','CANCELLED'}
    if not active and (data.quantity!=item.quantity or data.net_weight_g!=item.net_weight_g or data.product_id!=item.product_id):
        raise HTTPException(409,'Delivered or cancelled item stock details cannot be changed.')
    old_product_id=item.product_id if active else None
    product_ids=sorted({p for p in (old_product_id,data.product_id if active else None) if p is not None})
    locked={}
    for product_id in product_ids:
        product=locked_product(db,product_id)
        if not product: raise HTTPException(404,f'Product {product_id} not found')
        locked[product_id]=product
    old_product=locked.get(old_product_id)
    old_amount=stock_amount(item,old_product) if old_product else Decimal('0')
    if old_product:
        release_product(old_product,old_amount)
    apply_item_data(item,data)
    item.product_id=data.product_id
    new_product=locked.get(data.product_id) if active else None
    if new_product:
        amount=stock_amount(item,new_product)
        reserve_product(new_product,amount)
        record_transaction(db,new_product,'RESERVE',reserved_delta=amount,reference=item.order.order_number,reason=f'Reservation updated for {item.item_code}',order_id=item.order_id,order_item_id=item.id,user_id=_.id)
    if old_product:
        record_transaction(db,old_product,'RELEASE',reserved_delta=-old_amount,reference=item.order.order_number,reason=f'Previous reservation released for {item.item_code}',order_id=item.order_id,order_item_id=item.id,user_id=_.id)
    item.order.status=recompute_order_status(item.order)
    issue_invoice_if_delivered(item.order)
    record_audit(db,'item_updated','order_item',item.id,user_id=_.id,order_id=item.order_id,meta={'item_type':data.item_type,'quantity':data.quantity,'net_weight_g':data.net_weight_g,'gold_purity':data.gold_purity})
    db.commit()
    return load_order(db,item.order_id)
@router.delete('/items/{item_id}',summary='Cancel an order item without removing its history')
def delete_item(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    if item.status=='DELIVERED': raise HTTPException(409,'A delivered item cannot be cancelled.')
    if item.status=='CANCELLED': return {'id':item_id,'status':'CANCELLED'}
    order_id=item.order_id
    if item.product_id:
        p=locked_product(db,item.product_id)
        if p:
            amount=stock_amount(item,p)
            release_product(p,amount)
            record_transaction(db,p,'RELEASE',reserved_delta=-amount,reference=item.order.order_number,reason=f'Released for cancelled item {item.item_code}',order_id=order_id,order_item_id=item.id,user_id=_.id)
    previous=item.status
    item.status='CANCELLED'; item.cancellation_reason='Cancelled by staff'
    item.order.status=recompute_order_status(item.order)
    record_audit(db,'item_status_changed','order_item',item.id,user_id=_.id,order_id=order_id,meta={'from':previous,'to':'CANCELLED','reason':item.cancellation_reason})
    db.commit()
    return {'id':item_id,'status':'CANCELLED'}
@router.patch('/items/{item_id}/status',response_model=OrderOut,summary='Update an item status (validated transitions; delivery consumes reserved stock)')
def update_status(item_id:int,data:ItemStatusUpdate,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    if data.status not in ITEM_STATUSES: raise HTTPException(400,'Invalid status')
    if data.status not in ITEM_TRANSITIONS[item.status]: raise HTTPException(400,f'Invalid status transition from {item.status} to {data.status}')
    previous=item.status
    item.status=data.status; item.workshop_notes=data.workshop_notes if data.workshop_notes is not None else item.workshop_notes
    if data.status=='CANCELLED': item.cancellation_reason=(data.cancellation_reason or '').strip() or 'Cancelled by staff'
    if data.status=='READY' and not item.ready_at: item.ready_at=datetime.now(timezone.utc)
    if data.status=='DELIVERED' and not item.ready_at: item.ready_at=datetime.now(timezone.utc)
    if data.status=='DELIVERED' and item.product_id:
        p=locked_product(db,item.product_id)
        if p:
            consumed=stock_amount(item,p)
            if consumed>p.reserved_quantity or consumed>p.quantity: raise HTTPException(409,'Reserved stock is insufficient to deliver this item.')
            p.quantity-=consumed; p.reserved_quantity-=consumed
            record_transaction(db,p,'CONSUME',quantity_delta=-consumed,reserved_delta=-consumed,reference=item.order.order_number,reason=f'Consumed for delivered item {item.item_code}',order_id=item.order_id,order_item_id=item.id,user_id=_.id)
            record_audit(db,'inventory_consumed','product',p.id,user_id=_.id,order_id=item.order_id,meta={'sku':p.sku,'quantity':float(consumed),'unit':p.unit})
    if data.status=='CANCELLED' and item.product_id:
        p=db.get(Product,item.product_id)
        if p:
            amount=stock_amount(item,p)
            release_product(p,amount)
            record_transaction(db,p,'RELEASE',reserved_delta=-amount,reference=item.order.order_number,reason=f'Released for cancelled item {item.item_code}',order_id=item.order_id,order_item_id=item.id,user_id=_.id)
            record_audit(db,'inventory_released','product',p.id,user_id=_.id,order_id=item.order_id,meta={'sku':p.sku,'quantity':float(amount),'unit':p.unit})
    item.order.status=recompute_order_status(item.order)
    issue_invoice_if_delivered(item.order)
    record_audit(db,'item_status_changed','order_item',item.id,user_id=_.id,order_id=item.order_id,meta={'from':previous,'to':data.status,'reason':item.cancellation_reason if data.status=='CANCELLED' else None})
    if data.status=='READY': maybe_queue_ready_notification(db,item)
    db.commit()
    return load_order(db,item.order_id)
@router.post('/items/{item_id}/photo',summary='Upload a jewellery photo for an item (stored in S3/MinIO)')
def upload_photo(item_id:int,file:UploadFile=File(...),db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    if not (file.content_type or '').startswith('image/'): raise HTTPException(400,'Only image uploads are supported')
    key=f"orders/{item.order_id}/items/{item.id}/{uuid.uuid4().hex}-{safe_filename(file.filename)}"
    upload(key,file.file,file.content_type); item.photo_key=key; db.commit()
    return {'photo_key':key,'url':presigned(key)}
@router.get('/items/{item_id}/photo-url',summary='Get a presigned URL for the item photo')
def photo_url(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    return {'url':presigned(item.photo_key)}
@router.get('/items/{item_id}/qr',summary='Get a QR code PNG (base64) encoding the item code')
def qr(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.get(OrderItem,item_id)
    if not item: raise HTTPException(404,'Item not found')
    img=qrcode.make(item.item_code); buf=io.BytesIO(); img.save(buf,format='PNG')  # pyright: ignore[reportCallIssue] - qrcode image save signature
    return {'item_code':item.item_code,'png_base64':base64.b64encode(buf.getvalue()).decode()}
@router.post('/items/{item_id}/notify-ready',summary='Queue a WhatsApp ready notification for a READY item (respects opt-in, idempotent)')
def notify_ready(item_id:int,db:Session=Depends(get_db),_=Depends(current_user)):
    item=db.query(OrderItem).options(joinedload(OrderItem.order)).filter(OrderItem.id==item_id).first()
    if not item: raise HTTPException(404,'Item not found')
    if item.status!='READY': raise HTTPException(400,'Item is not READY')
    customer=db.get(Customer,item.order.customer_id)
    if not customer or not customer.whatsapp_opt_in: raise HTTPException(400,'Customer has not opted in to WhatsApp notifications')
    existing=db.query(Notification).filter(Notification.order_item_id==item.id,Notification.status.in_({'QUEUED','SENT'})).first()
    if existing: raise HTTPException(409,'A notification for this item is already queued or sent')
    n=Notification(customer_id=customer.id,order_id=item.order_id,order_item_id=item.id,channel='WHATSAPP',type='ORDER_READY',status='QUEUED'); db.add(n); db.flush()
    record_audit(db,'notification_queued','notification',n.id,user_id=_.id,order_id=item.order_id,meta={'type':'ORDER_READY'})
    db.commit()
    send_whatsapp_task.delay(n.id)
    return {'notification_id':n.id,'status':'QUEUED'}
