import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Customer,CustomerSummary,Order} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {ToastService} from '../../shared/toast.service';

@Component({selector:'app-customer-detail',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,RouterLink],template:`
<a class="link back-link" routerLink="/customers">← Back to Customers</a>

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading customer…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (customer(); as c) {
  <div class="page-head">
    <div>
      <h1 class="page-title">{{c.name}}</h1>
      <p class="page-sub">{{c.phone}} @if (c.whatsapp_opt_in) { <span class="badge badge-sent">WhatsApp opted in</span> } @else { <span class="badge badge-hold">No WhatsApp opt-in</span> }</p>
    </div>
    <div class="row">
      <button class="btn secondary" (click)="openEdit()">Edit</button>
      <button class="btn primary" [routerLink]="['/orders/new']" [queryParams]="{customer_id:c.id}">Create Order</button>
      <button class="btn secondary" (click)="openMessage()" [disabled]="!c.whatsapp_opt_in">Send WhatsApp</button>
    </div>
  </div>

  <div class="grid detail-grid">
    <div class="card">
      <h2 class="card-title">Customer Information</h2>
      <dl class="info-list">
        <div class="info-row"><dt>Customer ID</dt><dd>{{c.id}}</dd></div>
        <div class="info-row"><dt>Name</dt><dd>{{c.name}}</dd></div>
        <div class="info-row"><dt>Mobile</dt><dd>{{c.phone}}</dd></div>
        <div class="info-row"><dt>Email</dt><dd>{{c.email||'—'}}</dd></div>
        <div class="info-row"><dt>Address</dt><dd>{{c.address||'—'}}</dd></div>
        <div class="info-row"><dt>WhatsApp consent</dt><dd>@if (c.whatsapp_opt_in) { Opted in } @else { Not opted in }</dd></div>
        <div class="info-row"><dt>Notes</dt><dd>{{c.notes||'—'}}</dd></div>
        <div class="info-row"><dt>Added</dt><dd>{{c.created_at | date:'mediumDate'}}</dd></div>
      </dl>
    </div>

    <div class="card">
      <h2 class="card-title">Summary</h2>
      @if (summary(); as s) {
        <div class="kpi-grid small">
          <div class="kpi"><div class="kpi-value">{{s.orders_total}}</div><div class="kpi-label">Total Orders</div></div>
          <div class="kpi"><div class="kpi-value">{{s.orders_open + s.orders_in_progress}}</div><div class="kpi-label">Open Orders</div></div>
          <div class="kpi"><div class="kpi-value">{{s.orders_ready}}</div><div class="kpi-label">Ready Orders</div></div>
          <div class="kpi"><div class="kpi-value">{{s.orders_delivered}}</div><div class="kpi-label">Completed Orders</div></div>
          <div class="kpi"><div class="kpi-value">{{s.items_total}}</div><div class="kpi-label">Total Items</div></div>
          <div class="kpi"><div class="kpi-value">{{s.items_pending}}</div><div class="kpi-label">Pending Items</div></div>
          <div class="kpi"><div class="kpi-value">{{s.items_ready}}</div><div class="kpi-label">Ready Items</div></div>
        </div>
      } @else { <p class="muted">Loading summary…</p> }
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2 class="card-title">Order History</h2>
      <button class="btn secondary small" (click)="loadOrders()">Refresh</button>
    </div>
    @if (ordersLoading()) {
      <div class="empty"><div class="spinner"></div><p class="muted">Loading orders…</p></div>
    } @else if (!orders().length) {
      <div class="empty"><p class="muted">No orders yet. Create an order to start tracking jewellery work.</p></div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Order</th><th>Status</th><th>Items</th><th>Expected</th><th>Created</th><th></th></tr></thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr>
                <td><a class="link" [routerLink]="['/orders',o.id]">{{o.order_number}}</a></td>
                <td><app-status-badge [status]="o.status"/></td>
                <td>{{o.items.length}}</td>
                <td class="muted">{{o.expected_delivery_date | date:'mediumDate'}}</td>
                <td class="muted">{{o.created_at | date:'mediumDate'}}</td>
                <td class="actions-cell"><a class="btn secondary small" [routerLink]="['/orders',o.id]">View</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </div>
}

@if (editing(); as formState) {
  <div class="modal-backdrop" (click)="closeEdit()">
    <div class="modal card" (click)="$event.stopPropagation()">
      <h2 class="card-title">Edit Customer</h2>
      <form (ngSubmit)="save()">
        <div class="field"><label>Name</label><input class="input" name="dname" [(ngModel)]="formState.name" required></div>
        <div class="field"><label>Mobile number</label><input class="input" name="dphone" [(ngModel)]="formState.phone" required></div>
        <div class="field"><label>Email</label><input class="input" name="demail" [(ngModel)]="formState.email" type="email"></div>
        <div class="field"><label>Address</label><textarea class="input" name="daddress" [(ngModel)]="formState.address" rows="2"></textarea></div>
        <div class="field checkbox"><label><input type="checkbox" name="doptin" [(ngModel)]="formState.whatsapp_opt_in"> WhatsApp opt-in</label></div>
        <div class="field"><label>Notes</label><textarea class="input" name="dnotes" [(ngModel)]="formState.notes" rows="2"></textarea></div>
        @if (formError()) { <div class="error">{{formError()}}</div> }
        <div class="row modal-actions">
          <button class="btn secondary" type="button" (click)="closeEdit()">Cancel</button>
          <button class="btn primary" type="submit" [disabled]="saving()">Save</button>
        </div>
      </form>
    </div>
  </div>
}

@if (messaging()) {
  <div class="modal-backdrop" (click)="closeMessage()">
    <div class="modal card" (click)="$event.stopPropagation()">
      <h2 class="card-title">Send WhatsApp Message</h2>
      <p class="muted">A custom WhatsApp message will be queued for {{customer()?.name}} and processed by the notification worker.</p>
      <div class="field"><label>Message</label><textarea class="input" name="msg" [(ngModel)]="message" rows="4" placeholder="Dear customer, …"></textarea></div>
      @if (msgError()) { <div class="error">{{msgError()}}</div> }
      <div class="row modal-actions">
        <button class="btn secondary" type="button" (click)="closeMessage()">Cancel</button>
        <button class="btn primary" type="button" (click)="sendMessageNow()" [disabled]="sendingMsg()">{{sendingMsg() ? 'Queueing…' : 'Queue Message'}}</button>
      </div>
    </div>
  </div>
}
`})
export class CustomerDetailComponent implements OnInit{
  private http=inject(HttpClient);
  private route=inject(ActivatedRoute);
  private router=inject(Router);
  private toast=inject(ToastService);

  readonly customer=signal<Customer|null>(null);
  readonly summary=signal<CustomerSummary|null>(null);
  readonly orders=signal<Order[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly ordersLoading=signal(false);
  readonly editing=signal<{id:number;name:string;phone:string;email:string;address:string;whatsapp_opt_in:boolean;notes:string}|null>(null);
  readonly saving=signal(false);
  readonly formError=signal('');
  readonly messaging=signal(false);
  readonly sendingMsg=signal(false);
  readonly msgError=signal('');
  message='';

  ngOnInit(){this.route.paramMap.subscribe(params=>{this.load(Number(params.get('id')));this.loadOrders();});}

  private get id(){return this.customer()?.id||0;}

  load(id?:number){
    const target=id??this.customer()?.id;
    if(!target) return;
    this.loading.set(true); this.error.set('');
    this.http.get<Customer>(`/api/customers/${target}`).subscribe({
      next:c=>{this.customer.set(c);this.loading.set(false);
        this.loadOrders();
        this.http.get<CustomerSummary>(`/api/customers/${target}/summary`).subscribe({next:s=>this.summary.set(s),error:()=>this.summary.set(null)});},
      error:err=>{this.loading.set(false);this.error.set(this.messageText(err,'Could not load the customer.'));}
    });
  }

  loadOrders(){
    const id=this.id;
    if(!id) return;
    this.ordersLoading.set(true);
    this.http.get<Order[]>('/api/orders',{params:{customer_id:String(id),limit:'50'}}).subscribe({
      next:o=>{this.orders.set(o);this.ordersLoading.set(false);},
      error:()=>{this.ordersLoading.set(false);this.orders.set([]);}
    });
  }

  openEdit(){
    const c=this.customer();
    if(!c) return;
    this.editing.set({id:c.id,name:c.name,phone:c.phone,email:c.email||'',address:c.address||'',whatsapp_opt_in:c.whatsapp_opt_in,notes:c.notes||''});
    this.formError.set('');
  }

  closeEdit(){this.editing.set(null);}

  save(){
    const form=this.editing();
    if(!form||this.saving()) return;
    if(!form.name.trim()||!form.phone.trim()){this.formError.set('Name and mobile number are required.');return;}
    this.saving.set(true); this.formError.set('');
    const payload={name:form.name.trim(),phone:form.phone.trim(),email:form.email.trim()||null,address:form.address.trim()||null,whatsapp_opt_in:form.whatsapp_opt_in,notes:form.notes.trim()||null};
    this.http.patch<Customer>(`/api/customers/${form.id}`,payload).subscribe({
      next:c=>{this.saving.set(false);this.toast.success('Customer updated.');this.customer.set(c);this.closeEdit();},
      error:err=>{this.saving.set(false);this.formError.set(this.messageText(err,'Could not save the customer.'));}
    });
  }

  openMessage(){
    if(!this.customer()?.whatsapp_opt_in){
      this.toast.error('This customer has not opted in to WhatsApp notifications.');
      return;
    }
    this.message=''; this.msgError.set('');
    this.messaging.set(true);
  }

  closeMessage(){this.messaging.set(false);}

  sendMessageNow(){
    if(this.sendingMsg()) return;
    if(!this.message.trim()){this.msgError.set('Enter a message to send.');return;}
    this.sendingMsg.set(true); this.msgError.set('');
    const payload={customer_id:this.id,order_id:null,type:'CUSTOM',message:this.message.trim()};
    this.http.post('/api/notifications',payload).subscribe({
      next:()=>{
        this.sendingMsg.set(false);
        this.toast.success('WhatsApp message queued.');
        this.closeMessage();
      },
      error:err=>{this.sendingMsg.set(false);this.msgError.set(this.messageText(err,'Could not queue the message.'));}
    });
  }

  private messageText(err:unknown,fallback:string):string{
    const detail=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof detail==='string'?detail:fallback;
  }
}
