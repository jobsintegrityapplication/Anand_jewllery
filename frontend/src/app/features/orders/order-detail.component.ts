import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Order,OrderItem,Notification,AuditEntry,Product,ITEM_TYPES,ITEM_STATUSES} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {ToastService} from '../../shared/toast.service';

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
        <div class="info-row"><dt>Status</dt><dd><app-status-badge [status]="o.status"/></dd></div>
        <div class="info-row"><dt>Created</dt><dd>{{o.created_at | date:'medium'}}</dd></div>
        <div class="info-row"><dt>Expected completion</dt><dd>{{o.expected_delivery_date | date:'mediumDate'}}</dd></div>
        <div class="info-row"><dt>Notes</dt><dd>{{o.notes||'—'}}</dd></div>
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
          <thead><tr><th>Item Code</th><th>Type</th><th>Description</th><th>Qty</th><th>Status</th><th>Expected</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            @for (item of o.items; track item.id) {
              <tr>
                <td class="mono">{{item.item_code}}</td>
                <td>{{item.item_type}}</td>
                <td>{{item.description||'—'}}</td>
                <td>{{item.quantity}}</td>
                <td><app-status-badge [status]="item.status"/></td>
                <td class="muted">{{item.expected_date | date:'mediumDate'}}</td>
                <td class="muted">{{item.workshop_notes||'—'}}</td>
                <td class="actions-cell">
                  @if (itemTerminal(item.status)) {
                    <span class="muted small-label">Final</span>
                  } @else {
                    <select class="input select-small" [ngModel]="item.status" (ngModelChange)="updateItemStatus(item,$event)" [attr.aria-label]="'Update status for '+item.item_code">
                      @for (s of nextItemStatuses(item.status); track s) { <option [value]="s">{{s}}</option> }
                    </select>
                  }
                  <button class="btn secondary small" type="button" (click)="showQr(item)">QR</button>
                  @if (item.photo_key) {
                    <button class="btn secondary small" type="button" (click)="openPhoto(item)">Photo</button>
                  }
                  @if (item.status==='READY') {
                    <button class="btn primary small" type="button" (click)="notifyReady(item)">Notify Ready</button>
                  }
                  @if (!terminal(o.status)) {
                    <button class="btn danger small" type="button" (click)="removeItem(item)">Delete</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (adding()) {
      <div class="item-editor">
        <div class="item-editor-head"><strong>New Item</strong><button class="btn danger small" type="button" (click)="cancelAdd()">Remove</button></div>
        <div class="grid form-grid">
          <div class="field">
            <label>Item type</label>
            <select class="input" name="dtype" [(ngModel)]="draft.item_type">
              @for (t of ITEM_TYPES; track t) { <option [value]="t">{{t}}</option> }
            </select>
          </div>
          <div class="field"><label>Quantity</label><input class="input" type="number" min="1" name="dqty" [(ngModel)]="draft.quantity"></div>
          <div class="field"><label>Expected completion date</label><input class="input" type="date" name="dexp" [(ngModel)]="draft.expected_date"></div>
          <div class="field"><label>Estimated value (optional)</label><input class="input" type="number" min="0" name="dval" [(ngModel)]="draft.estimated_value"></div>
          <div class="field span-2"><label>Description</label><input class="input" name="ddesc" [(ngModel)]="draft.description"></div>
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
        <div class="row"><button class="btn primary" type="button" (click)="saveItem()">Add to Order</button></div>
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

  private readonly ORDER_TRANSITIONS:Record<string,string[]>={
    'OPEN':['IN_PROGRESS','READY','DELIVERED','CANCELLED'],
    'IN_PROGRESS':['PARTIALLY_READY','READY','DELIVERED','CANCELLED'],
    'PARTIALLY_READY':['READY','IN_PROGRESS','DELIVERED','CANCELLED'],
    'READY':['DELIVERED','IN_PROGRESS','PARTIALLY_READY','CANCELLED'],
    'DELIVERED':[],
    'CANCELLED':[],
  };
  private readonly ITEM_TRANSITIONS:Record<string,string[]>={
    'ORDER_CREATED':['SENT_TO_WORKSHOP','IN_PROGRESS','ON_HOLD','CANCELLED'],
    'SENT_TO_WORKSHOP':['IN_PROGRESS','QUALITY_CHECK','ON_HOLD','CANCELLED'],
    'IN_PROGRESS':['QUALITY_CHECK','READY','REWORK_REQUIRED','ON_HOLD','CANCELLED'],
    'QUALITY_CHECK':['READY','REWORK_REQUIRED','IN_PROGRESS'],
    'REWORK_REQUIRED':['IN_PROGRESS','ON_HOLD','CANCELLED'],
    'READY':['DELIVERED','QUALITY_CHECK','ON_HOLD'],
    'ON_HOLD':['IN_PROGRESS','CANCELLED'],
    'DELIVERED':[],
    'CANCELLED':[],
  };

  readonly order=signal<Order|null>(null);
  readonly notifications=signal<Notification[]>([]);
  readonly products=signal<Product[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly adding=signal(false);
  readonly qr=signal<{item_code:string;png_base64:string}|null>(null);
  draft={item_type:'Ring',description:'',quantity:1,expected_date:'',estimated_value:null as number|null,workshop_notes:'',product_id:null as number|null};

  ngOnInit(){
    this.load();
    this.loadProducts();
    this.route.paramMap.subscribe(params=>this.load(Number(params.get('id'))));
  }

  terminal(status:string){return this.ORDER_TRANSITIONS[status]?.length===0;}
  itemTerminal(status:string){return this.ITEM_TRANSITIONS[status]?.length===0;}
  nextOrderStatuses(status:string){return this.ORDER_TRANSITIONS[status]||[];}
  nextItemStatuses(status:string){return this.ITEM_TRANSITIONS[status]||[];}

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

  updateItemStatus(item:OrderItem,target:string){
    if(!target||target===item.status) return;
    this.http.patch<Order>(`/api/orders/items/${item.id}/status`,{status:target}).subscribe({
      next:o=>{
        this.order.set(o);
        this.toast.success(`Item marked ${target}.`);
        this.loadNotifications();
      },
      error:err=>{this.toast.error(this.detail(err,'Invalid status transition.'));this.load();}
    });
  }

  addItem(){this.draft={item_type:'Ring',description:'',quantity:1,expected_date:'',estimated_value:null,workshop_notes:'',product_id:null};this.adding.set(true);}

  cancelAdd(){this.adding.set(false);}

  saveItem(){
    const o=this.order();
    if(!o) return;
    if(!this.draft.item_type||this.draft.quantity<1){this.toast.error('The item needs a type and a quantity of at least 1.');return;}
    const payload={
      item_type:this.draft.item_type,
      description:this.draft.description.trim()||null,
      quantity:this.draft.quantity,
      expected_date:this.draft.expected_date||null,
      estimated_value:this.draft.estimated_value,
      workshop_notes:this.draft.workshop_notes.trim()||null,
      product_id:this.draft.product_id,
    };
    this.http.post<Order>(`/api/orders/${o.id}/items`,payload).subscribe({
      next:o=>{this.order.set(o);this.adding.set(false);this.toast.success('Item added to the order.');},
      error:err=>{this.toast.error(this.detail(err,'Could not add the item.'));}
    });
  }

  removeItem(item:OrderItem){
    if(!confirm(`Delete item ${item.item_code}? Any reserved stock will be released.`)) return;
    this.http.delete(`/api/orders/items/${item.id}`).subscribe({
      next:()=>{this.toast.success('Item deleted.');this.load();},
      error:err=>{this.toast.error(this.detail(err,'Could not delete the item.'));}
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
