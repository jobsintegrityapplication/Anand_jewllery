import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Order,OrderItem,Notification,AuditEntry,Product,ITEM_TYPES,ITEM_STATUSES} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {ToastService} from '../../shared/toast.service';

interface ItemEditorDraft{
  item_type:string;description:string;design:string;quantity:number;count:number;expected_date:string;
  estimated_value:number|null;gold_rate:number|null;gold_purity:string;net_weight_g:number|null;
  making_charges:number|null;wastage_percent:number|null;other_charges:number|null;
  workshop_notes:string;product_id:number|null;designImage:File|null;
}

const EMPTY_DRAFT:ItemEditorDraft={item_type:'Ring',description:'',design:'',quantity:1,count:1,expected_date:'',estimated_value:null,gold_rate:null,gold_purity:'22K',net_weight_g:null,making_charges:null,wastage_percent:null,other_charges:null,workshop_notes:'',product_id:null,designImage:null};

@Component({selector:'app-order-detail',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,RouterLink],template:`
<a class="link back-link" routerLink="/orders">← Back to Orders</a>

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading order…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (order(); as o) {
  <div class="page-head">
    <div>
      <h1 class="page-title">{{o.order_number}}</h1>
      <p class="page-sub">
        <a class="link" [routerLink]="['/customers',o.customer_id]">{{o.customer?.name}}</a>
        <span class="muted">· {{o.customer?.phone}}</span>
        @if (o.customer?.whatsapp_opt_in) { <span class="badge badge-sent">WhatsApp opted in</span> } @else { <span class="badge badge-hold">No WhatsApp opt-in</span> }
      </p>
    </div>
    <div class="row">
      @if (!terminal(o.status)) {
        <select class="input" [ngModel]="o.status" (ngModelChange)="updateOrderStatus(o,$event)" aria-label="Update order status">
          @for (s of nextOrderStatuses(o.status); track s) { <option [value]="s">{{s}}</option> }
        </select>
      }
    </div>
  </div>

  <div class="card">
    <h2 class="card-title">Order Timeline</h2>
    <div class="timeline">
      @for (step of timelineSteps(); track step.label) {
        <div class="timeline-step {{step.state}}">
          <span class="timeline-dot"></span>
          <span class="timeline-label">{{step.label}}</span>
        </div>
      }
    </div>
    @if (o.status==='CANCELLED') { <p class="error">This order is cancelled.</p> }
  </div>

  <div class="grid detail-grid">
    <div class="card">
      <h2 class="card-title">Order Information</h2>
      <dl class="info-list">
        <div class="info-row"><dt>Order number</dt><dd>{{o.order_number}}</dd></div>
        <div class="info-row"><dt>Customer</dt><dd><a class="link" [routerLink]="['/customers',o.customer_id]">{{o.customer?.name}}</a></dd></div>
        <div class="info-row"><dt>Phone</dt><dd>{{o.customer?.phone}}</dd></div>
        <div class="info-row"><dt>Email</dt><dd>{{o.customer?.email||'—'}}</dd></div>
        <div class="info-row"><dt>Address</dt><dd>{{o.customer?.address||'—'}}</dd></div>
        <div class="info-row"><dt>Status</dt><dd><app-status-badge [status]="o.status"/></dd></div>
        <div class="info-row"><dt>Created</dt><dd>{{o.created_at | date:'medium'}}</dd></div>
        <div class="info-row"><dt>Expected completion</dt><dd>{{o.expected_delivery_date | date:'mediumDate'}}</dd></div>
        <div class="info-row"><dt>Notes</dt><dd>{{o.notes||'—'}}</dd></div>
        <div class="info-row"><dt>Total estimated value</dt><dd>{{o.total_estimated_value | currency:'INR':'symbol':'1.2-2'}}</dd></div>
      </dl>
    </div>

    <div class="card">
      <div class="card-head">
        <h2 class="card-title">Notification History</h2>
        <button class="btn secondary small" (click)="loadNotifications()">Refresh</button>
      </div>
      @if (!notifications().length) {
        <p class="muted">No notifications found for this order.</p>
      } @else {
        <ul class="list">
          @for (n of notifications(); track n.id) {
            <li class="list-row notif-row">
              <div class="notif-main">
                <span><app-status-badge [status]="n.status"/></span>
                <span class="badge badge-default">{{n.type||'CUSTOM'}}</span>
                <span class="muted">{{n.created_at | date:'short'}}</span>
              </div>
              @if (n.message) { <div class="notif-message">{{n.message}}</div> }
              @if (n.error) { <div class="error notif-message">{{n.error}}</div> }
            </li>
          }
        </ul>
      }
    </div>
  </div>

  <section class="card payment-card">
    <div class="card-head">
      <div><h2 class="card-title">Payments &amp; invoice</h2><p class="muted payment-subtitle">{{o.status==='DELIVERED'?'Collect the remaining balance and download the updated final invoice.':'Record advances and see the outstanding balance.'}}</p></div>
      @if (o.status==='DELIVERED') {
        <button class="btn primary" type="button" (click)="downloadInvoice()" [disabled]="invoiceDownloading()">{{invoiceDownloading()?'Preparing PDF…':'Download / Print Invoice'}}</button>
      } @else {
        <span class="badge badge-hold">Invoice available on delivery</span>
      }
    </div>
    <div class="payment-summary-grid">
      <article><span>Order estimate</span><strong>{{o.total_estimated_value | currency:'INR':'symbol':'1.2-2'}}</strong></article>
      <article><span>Paid so far</span><strong>{{o.amount_paid | currency:'INR':'symbol':'1.2-2'}}</strong></article>
      <article class="balance-highlight"><span>Balance due</span><strong>{{o.balance_due | currency:'INR':'symbol':'1.2-2'}}</strong></article>
      <article><span>Payment status</span><strong>{{statusLabel(o.payment_status)}}</strong></article>
    </div>
    @if (o.status!=='CANCELLED' && o.balance_due>0) {
      <div class="payment-entry">
        <h3>{{o.status==='DELIVERED'?'Collect final balance':'Record advance / payment'}}</h3>
        <div class="grid form-grid">
          <div class="field"><label>Amount received now (₹)</label><input class="input" type="number" min="0.01" step="0.01" [max]="o.balance_due" name="paymentAmount" [(ngModel)]="paymentAmount" placeholder="Enter amount received, e.g. 10000"></div>
          <div class="field"><label>Payment method</label><select class="input" name="paymentMethod" [(ngModel)]="paymentMethod">@for (method of PAYMENT_METHODS; track method.value) { <option [value]="method.value">{{method.label}}</option> }</select></div>
          <div class="field"><label>Transaction / receipt reference (optional)</label><input class="input" name="paymentReference" [(ngModel)]="paymentReference" placeholder="UPI transaction ID or cash receipt number"></div>
          <div class="field"><label>Note (optional)</label><input class="input" name="paymentNote" [(ngModel)]="paymentNote" placeholder="Advance, final settlement…"></div>
        </div>
        <button class="btn primary" type="button" (click)="recordPayment()" [disabled]="savingPayment() || !paymentAmount || paymentAmount<=0">{{savingPayment()?'Saving payment…':(o.status==='DELIVERED'?'Record final payment':'Record payment')}}</button>
        <p class="muted payment-method-note">Enter only the money received now above. Use the reference field for a transaction or receipt number. Available methods: Cash, UPI, Card, Bank transfer, Cheque, and Other.</p>
      </div>
    }
    @if (o.status==='DELIVERED' && o.balance_due===0) { <p class="muted payment-method-note">The order is fully paid. Download / Print Invoice above to generate the latest final invoice with a zero balance.</p> }
    @if (o.payments.length) {
      <div class="payment-history"><h3>Payment history</h3><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Note</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>@for (payment of o.payments; track payment.id) { <tr><td>{{payment.paid_at | date:'medium'}}</td><td>{{statusLabel(payment.method)}}</td><td>{{payment.reference||'—'}}</td><td>{{payment.note||'—'}}</td><td>{{payment.amount | currency:'INR':'symbol':'1.2-2'}}</td><td><button class="btn secondary small" type="button" (click)="downloadPaymentReceipt(payment.id)" [disabled]="receiptDownloading()===payment.id">{{receiptDownloading()===payment.id?'Preparing…':'Download'}}</button></td></tr> }</tbody></table></div></div>
    } @else {
      <p class="muted payment-empty">No payments recorded yet.</p>
    }
  </section>

  <div class="card">
    <div class="card-head">
      <h2 class="card-title">Items</h2>
      @if (!terminal(o.status)) {
        <button class="btn primary small" type="button" (click)="addItem()">Add Item</button>
      }
    </div>
    @if (!o.items.length) {
      <p class="muted">No items on this order yet. Use “Add Item” to add jewellery items.</p>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Item</th><th>Qty</th><th>Design</th><th>Purity</th><th>Net weight</th><th>Gold rate</th><th>Count</th><th>Estimated value</th><th>Completion</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            @for (item of o.items; track item.id) {
              <tr>
                <td>{{item.item_type}}<small class="muted mono"><br>{{item.item_code}}</small></td>
                <td>{{item.quantity}}</td>
                <td>{{item.design||item.description||'—'}} @if(item.photo_key){<small class="muted"><br>Reference image attached</small>}</td>
                <td>{{item.gold_purity||'—'}}</td>
                <td>{{item.net_weight_g!=null?(item.net_weight_g+' g'):'—'}}</td>
                <td>{{item.gold_rate!=null?(item.gold_rate | currency:'INR':'symbol':'1.2-2')+'/g':'—'}}</td>
                <td>{{item.count}}</td>
                <td>{{item.estimated_value!=null?(item.estimated_value | currency:'INR':'symbol':'1.2-2'):'—'}}</td>
                <td class="muted">{{item.expected_date | date:'mediumDate'}}</td>
                <td><app-status-badge [status]="item.status"/> @if(item.cancellation_reason){<small class="muted"><br>{{item.cancellation_reason}}</small>}</td>
                <td class="actions-cell">
                  @if (itemTerminal(item.status)) {
                    <span class="muted small-label">Final</span>
                  } @else {
                    <select class="input select-small" [ngModel]="item.status" (ngModelChange)="updateItemStatus(item,$event)" [attr.aria-label]="'Update status for '+item.item_code">
                      @for (s of nextItemStatuses(item.status); track s) { <option [value]="s" [disabled]="s==='DELIVERED' && item.status!=='READY'">{{statusLabel(s)}}</option> }
                    </select>
                  }
                  <button class="btn secondary small" type="button" (click)="showQr(item)">QR</button>
                  @if (item.status!=='DELIVERED' && item.status!=='CANCELLED') { <button class="btn secondary small" type="button" (click)="editItem(item)">Edit</button> }
                  @if (item.photo_key) {
                    <button class="btn secondary small" type="button" (click)="openPhoto(item)">Photo</button>
                  }
                  @if (item.status!=='DELIVERED' && item.status!=='CANCELLED') { <label class="btn secondary small photo-upload">Attach image<input type="file" accept="image/*" (change)="uploadPhoto(item,$event)"></label> }
                  @if (item.status==='READY') {
                    <button class="btn primary small" type="button" (click)="notifyReady(item)">Notify Ready</button>
                  }
                  @if (item.status!=='DELIVERED' && item.status!=='CANCELLED') {
                    <button class="btn danger small" type="button" (click)="cancelItem(item)">Cancel item</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (adding() || editingItem()) {
      <div class="item-editor">
        <div class="item-editor-head"><strong>{{editingItem()?'Edit Item':'New Item'}}</strong><button class="btn secondary small" type="button" (click)="cancelAdd()">Close</button></div>
        <div class="grid form-grid">
          <div class="field">
            <label>Item type</label>
            <select class="input" name="dtype" [(ngModel)]="draft.item_type">
              @for (t of ITEM_TYPES; track t) { <option [value]="t">{{t}}</option> }
            </select>
          </div>
          <div class="field"><label>Quantity</label><input class="input" type="number" min="1" step="1" name="dqty" [(ngModel)]="draft.quantity"></div>
          <div class="field"><label>Count</label><input class="input" type="number" min="1" step="1" name="dcount" [(ngModel)]="draft.count"></div>
          <div class="field"><label>Expected completion date</label><input class="input" type="date" name="dexp" [(ngModel)]="draft.expected_date"></div>
          <div class="field"><label>Gold purity</label><input class="input" name="dpurity" [(ngModel)]="draft.gold_purity" placeholder="22K"></div>
          <div class="field span-2"><label>Design</label><input class="input" name="ddesign" [(ngModel)]="draft.design" placeholder="Design name or reference"></div>
          <div class="field"><label>Net weight (g)</label><input class="input" type="number" min="0" step="0.001" name="dweight" [(ngModel)]="draft.net_weight_g"></div>
          <div class="field"><label>Gold rate (₹ / g)</label><input class="input" type="number" min="0" step="0.01" name="drate" [(ngModel)]="draft.gold_rate"></div>
          <div class="field"><label>Making charges (₹)</label><input class="input" type="number" min="0" step="0.01" name="dmaking" [(ngModel)]="draft.making_charges"></div>
          <div class="field"><label>Wastage (%)</label><input class="input" type="number" min="0" max="100" step="0.001" name="dwastage" [(ngModel)]="draft.wastage_percent"></div>
          <div class="field"><label>Stone / other charges (₹)</label><input class="input" type="number" min="0" step="0.01" name="dother" [(ngModel)]="draft.other_charges"></div>
          <div class="field"><label>Total estimated value (₹)</label><input class="input" type="number" min="0" step="0.01" name="dval" [(ngModel)]="draft.estimated_value"></div>
          <div class="field span-2 estimate-note">Gold base reference: {{goldValue() | currency:'INR':'symbol':'1.2-2'}} <span>Weight × entered gold rate. Estimate remains staff-entered.</span></div>
          <div class="field span-2"><label>Design notes / dimensions</label><textarea class="input" name="ddesc" [(ngModel)]="draft.description" rows="2"></textarea></div>
          <div class="field span-2"><label>Design / reference image</label><input class="input" type="file" accept="image/*" (change)="selectPhoto($event)"><small class="muted" *ngIf="draft.designImage">{{draft.designImage.name}}</small></div>
          <div class="field span-2">
            <label>Link inventory product (optional)</label>
            <select class="input" name="dprod" [(ngModel)]="draft.product_id">
              <option [ngValue]="null">No inventory link</option>
              @for (p of products(); track p.id) {
                <option [ngValue]="p.id">{{p.sku}} — {{p.name}} ({{p.available_quantity}} available)</option>
              }
            </select>
          </div>
          <div class="field span-2"><label>Item notes</label><input class="input" name="dnotes" [(ngModel)]="draft.workshop_notes"></div>
        </div>
        <div class="row"><button class="btn primary" type="button" (click)="saveItem()">{{editingItem()?'Save Changes':'Add to Order'}}</button></div>
      </div>
    }
  </div>
}

@if (qr(); as q) {
  <div class="modal-backdrop" (click)="closeQr()">
    <div class="modal card qr-modal" (click)="$event.stopPropagation()">
      <h2 class="card-title">Item QR Code</h2>
      <p class="mono">{{q.item_code}}</p>
      <img [src]="'data:image/png;base64,'+q.png_base64" [alt]="'QR code for '+q.item_code" width="220" height="220">
      <div class="row modal-actions">
        <button class="btn secondary" type="button" (click)="closeQr()">Close</button>
      </div>
    </div>
  </div>
}
`})
export class OrderDetailComponent implements OnInit{
  private http=inject(HttpClient);
  private route=inject(ActivatedRoute);
  private router=inject(Router);
  private toast=inject(ToastService);
  readonly ITEM_TYPES=ITEM_TYPES;
  readonly ITEM_STATUSES=ITEM_STATUSES;
  readonly PAYMENT_METHODS=[{value:'CASH',label:'Cash'},{value:'UPI',label:'UPI'},{value:'CARD',label:'Card'},{value:'BANK_TRANSFER',label:'Bank transfer'},{value:'CHEQUE',label:'Cheque'},{value:'OTHER',label:'Other'}];

  private readonly ORDER_TRANSITIONS:Record<string,string[]>={
    'OPEN':['IN_PROGRESS','READY','DELIVERED','CANCELLED'],
    'IN_PROGRESS':['PARTIALLY_READY','READY','DELIVERED','CANCELLED'],
    'PARTIALLY_READY':['READY','IN_PROGRESS','DELIVERED','CANCELLED'],
    'READY':['DELIVERED','IN_PROGRESS','PARTIALLY_READY','CANCELLED'],
    'DELIVERED':[],
    'CANCELLED':[],
  };
  private readonly ITEM_WORKFLOW_STATUSES=['ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','DELIVERED','ON_HOLD','CANCELLED'];

  readonly order=signal<Order|null>(null);
  readonly notifications=signal<Notification[]>([]);
  readonly products=signal<Product[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly adding=signal(false);
  readonly editingItem=signal<number|null>(null);
  readonly qr=signal<{item_code:string;png_base64:string}|null>(null);
  readonly savingPayment=signal(false);
  readonly invoiceDownloading=signal(false);
  readonly receiptDownloading=signal<number|null>(null);
  paymentAmount:number|null=null;
  paymentMethod='UPI';
  paymentReference='';
  paymentNote='';
  draft:ItemEditorDraft={...EMPTY_DRAFT};

  ngOnInit(){
    this.load();
    this.loadProducts();
    this.route.paramMap.subscribe(params=>this.load(Number(params.get('id'))));
  }

  terminal(status:string){return this.ORDER_TRANSITIONS[status]?.length===0;}
  itemTerminal(status:string){return status==='DELIVERED'||status==='CANCELLED';}
  nextOrderStatuses(status:string){return this.ORDER_TRANSITIONS[status]||[];}
  nextItemStatuses(_status:string){return this.ITEM_WORKFLOW_STATUSES;}
  statusLabel(status:string){return status.toLowerCase().split('_').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');}

  recordPayment(){
    const order=this.order();
    if(!order||!this.paymentAmount||this.paymentAmount<=0)return;
    this.savingPayment.set(true);
    this.http.post<Order>(`/api/orders/${order.id}/payments`,{amount:this.paymentAmount,method:this.paymentMethod,reference:this.paymentReference.trim()||null,note:this.paymentNote.trim()||null}).subscribe({
      next:updated=>{this.order.set(updated);this.paymentAmount=null;this.paymentReference='';this.paymentNote='';this.savingPayment.set(false);this.toast.success('Payment recorded. Receipt downloading.');const latest=updated.payments[updated.payments.length-1];if(latest)this.downloadPaymentReceipt(latest.id);},
      error:err=>{this.savingPayment.set(false);this.toast.error(this.detail(err,'Could not record payment.'));}
    });
  }

  downloadInvoice(){
    const order=this.order();
    if(!order||order.status!=='DELIVERED')return;
    this.invoiceDownloading.set(true);
    this.http.get(`/api/orders/${order.id}/invoice`,{responseType:'blob'}).subscribe({
      next:pdf=>{this.savePdf(pdf,`${order.invoice_number||'INV-'+order.order_number}.pdf`);this.invoiceDownloading.set(false);},
      error:err=>{this.invoiceDownloading.set(false);this.downloadError(err,'Could not generate invoice PDF.');}
    });
  }

  downloadPaymentReceipt(paymentId:number){
    const order=this.order();
    if(!order)return;
    this.receiptDownloading.set(paymentId);
    this.http.get(`/api/orders/${order.id}/payments/${paymentId}/receipt`,{responseType:'blob'}).subscribe({
      next:pdf=>{this.savePdf(pdf,`RCP-${String(paymentId).padStart(6,'0')}-${order.order_number}.pdf`);this.receiptDownloading.set(null);},
      error:err=>{this.receiptDownloading.set(null);this.downloadError(err,'Could not download payment receipt.');}
    });
  }

  private savePdf(pdf:Blob,filename:string){
    const url=URL.createObjectURL(pdf);const link=document.createElement('a');link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  private downloadError(err:unknown,fallback:string){
    const body=(err as {error?:unknown})?.error;
    if(body instanceof Blob){
      void body.text().then(raw=>{
        try{const parsed=JSON.parse(raw) as {detail?:unknown};this.toast.error(typeof parsed.detail==='string'?parsed.detail:fallback);}
        catch{this.toast.error(raw||fallback);}
      });
      return;
    }
    this.toast.error(this.detail(err,fallback));
  }

  timelineSteps(){
    const o=this.order();
    const order=o?o.status:'OPEN';
    const cancelled=order==='CANCELLED';
    const labels=['OPEN','IN_PROGRESS','READY','DELIVERED'];
    const currentIndex=cancelled?-1:Math.max(0,labels.indexOf(order==='PARTIALLY_READY'?'IN_PROGRESS':order));
    return labels.map((label,index)=>({
      label,
      state:cancelled?'upcoming':(index<currentIndex?'done':(index===currentIndex?'current':'upcoming')),
    }));
  }

  load(id?:number){
    const target=id??Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true); this.error.set('');
    this.http.get<Order>(`/api/orders/${target}`).subscribe({
      next:o=>{this.order.set(o);this.loading.set(false);this.loadNotifications();},
      error:err=>{
        this.loading.set(false);
        this.error.set(this.detail(err,'Could not load the order.'));
      }
    });
  }

  loadNotifications(){
    const id=this.order()?.id;
    if(!id) return;
    this.http.get<Notification[]>('/api/notifications',{params:{order_id:String(id),limit:'50'}}).subscribe({
      next:n=>this.notifications.set(n),
      error:()=>this.notifications.set([])
    });
  }

  loadProducts(){
    this.http.get<Product[]>('/api/products',{params:{limit:'200'}}).subscribe({
      next:list=>this.products.set(list),
      error:()=>this.products.set([])
    });
  }

  updateOrderStatus(order:Order,target:string){
    if(!target||target===order.status) return;
    this.http.patch<Order>(`/api/orders/${order.id}`,{status:target}).subscribe({
      next:o=>{this.toast.success(`Order marked ${target}.`);this.order.set(o);this.loadNotifications();},
      error:err=>{this.toast.error(this.detail(err,'Invalid status transition.'));this.load();}
    });
  }

  updateItemStatus(item:OrderItem,target:string,cancellation_reason?:string){
    if(!target||target===item.status) return;
    this.http.patch<Order>(`/api/orders/items/${item.id}/status`,{status:target,cancellation_reason}).subscribe({
      next:o=>{
        this.order.set(o);
        this.toast.success(`Item marked ${target}.`);
        this.loadNotifications();
      },
      error:err=>{this.toast.error(this.detail(err,'Invalid status transition.'));this.load();}
    });
  }

  addItem(){this.draft={...EMPTY_DRAFT};this.editingItem.set(null);this.adding.set(true);}

  editItem(item:OrderItem){
    this.adding.set(false);this.editingItem.set(item.id);
    this.draft={item_type:item.item_type,description:item.description||'',design:item.design||'',quantity:item.quantity,count:item.count||1,expected_date:item.expected_date||'',estimated_value:item.estimated_value,gold_rate:item.gold_rate,gold_purity:item.gold_purity||'',net_weight_g:item.net_weight_g,making_charges:item.making_charges,wastage_percent:item.wastage_percent,other_charges:item.other_charges,workshop_notes:item.workshop_notes||'',product_id:item.product_id,designImage:null};
  }

  cancelAdd(){this.adding.set(false);this.editingItem.set(null);}

  goldValue(){return (this.draft.net_weight_g||0)*(this.draft.gold_rate||0);}

  selectPhoto(event:Event){this.draft.designImage=(event.target as HTMLInputElement).files?.[0]||null;}

  saveItem(){
    const o=this.order();
    if(!o) return;
    if(!this.draft.item_type||this.draft.quantity<1||this.draft.count<1){this.toast.error('The item needs a type, quantity and count of at least 1.');return;}
    const payload={
      item_type:this.draft.item_type,
      description:this.draft.description.trim()||null,
      design:this.draft.design.trim()||null,
      quantity:this.draft.quantity,
      count:this.draft.count,
      expected_date:this.draft.expected_date||null,
      estimated_value:this.draft.estimated_value,
      gold_rate:this.draft.gold_rate,
      gold_purity:this.draft.gold_purity.trim()||null,
      net_weight_g:this.draft.net_weight_g,
      making_charges:this.draft.making_charges,
      wastage_percent:this.draft.wastage_percent,
      other_charges:this.draft.other_charges,
      workshop_notes:this.draft.workshop_notes.trim()||null,
      product_id:this.draft.product_id,
    };
    const editingId=this.editingItem();
    const request=editingId?this.http.patch<Order>(`/api/orders/items/${editingId}`,payload):this.http.post<Order>(`/api/orders/${o.id}/items`,payload);
    request.subscribe({
      next:updated=>{
        const savedItemId=editingId||updated.items.find(i=>!o.items.some(existing=>existing.id===i.id))?.id;
        const file=this.draft.designImage;
        const finish=()=>{this.order.set(updated);this.cancelAdd();this.toast.success(editingId?'Item updated.':'Item added to the order.');};
        if(!file||!savedItemId){finish();return;}
        const form=new FormData();form.append('file',file);
        this.http.post(`/api/orders/items/${savedItemId}/photo`,form).subscribe({
          next:()=>{this.order.set(updated);this.cancelAdd();this.load();this.toast.success(editingId?'Item updated with its design image.':'Item added with its design image.');},
          error:()=>{finish();this.toast.error('Item saved, but its design image did not upload.');}
        });
      },
      error:err=>{this.toast.error(this.detail(err,'Could not add the item.'));}
    });
  }

  cancelItem(item:OrderItem){
    const reason=prompt(`Reason for cancelling ${item.item_code}:`);
    if(reason===null) return;
    this.updateItemStatus(item,'CANCELLED',reason.trim()||'Customer requested cancellation');
  }

  uploadPhoto(item:OrderItem,event:Event){
    const input=event.target as HTMLInputElement;const file=input.files?.[0];
    if(!file) return;
    if(!file.type.startsWith('image/')||file.size>10*1024*1024){this.toast.error('Choose an image smaller than 10 MB.');input.value='';return;}
    const form=new FormData();form.append('file',file);
    this.http.post(`/api/orders/items/${item.id}/photo`,form).subscribe({
      next:()=>{this.toast.success('Design image attached.');this.load();input.value='';},
      error:err=>{this.toast.error(this.detail(err,'Could not upload the image.'));input.value='';}
    });
  }

  showQr(item:OrderItem){
    this.http.get<{item_code:string;png_base64:string}>(`/api/orders/items/${item.id}/qr`).subscribe({
      next:q=>this.qr.set(q),
      error:()=>this.toast.error('Could not generate the QR code.')
    });
  }

  closeQr(){this.qr.set(null);}

  openPhoto(item:OrderItem){
    this.http.get<{url:string|null}>(`/api/orders/items/${item.id}/photo-url`).subscribe({
      next:res=>{if(res.url) window.open(res.url,'_blank');else this.toast.error('No photo attached to this item.');},
      error:()=>this.toast.error('Could not get the photo URL.')
    });
  }

  notifyReady(item:OrderItem){
    this.http.post<{notification_id:number;status:string}>(`/api/orders/items/${item.id}/notify-ready`,{}).subscribe({
      next:res=>{this.toast.success(`WhatsApp notification ${res.status.toLowerCase()}.`);this.loadNotifications();},
      error:err=>{this.toast.error(this.detail(err,'Could not queue the notification.'));}
    });
  }

  private detail(err:unknown,fallback:string):string{
    const d=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof d==='string'?d:fallback;
  }
}
