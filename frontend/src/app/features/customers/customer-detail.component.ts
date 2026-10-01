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
  <a class="customer-back-link" routerLink="/customers">← All customers</a>
  <section class="customer-profile-banner">
    <div class="customer-profile-identity"><div class="customer-profile-avatar">{{initials(c.name)}}</div><div><span class="customer-eyebrow">PRIVATE CLIENT · CLIENT ID {{c.id}}</span><h1>{{c.name}}</h1><div class="customer-profile-contact"><span>{{c.phone}}</span><span class="customer-dot">·</span><span>{{c.email||'Email not added'}}</span></div></div></div>
    <div class="customer-profile-actions"><button class="btn secondary" (click)="openEdit()">Edit customer</button><button class="btn primary" [routerLink]="['/orders/new']" [queryParams]="{customer_id:c.id}">＋ New order</button></div>
  </section>

  @if (summary(); as s) { <div class="customer-metrics"><article><span>All orders</span><strong>{{s.orders_total}}</strong></article><article><span>In progress</span><strong>{{s.orders_open+s.orders_in_progress}}</strong></article><article><span>Ready</span><strong>{{s.orders_ready}}</strong></article><article><span>Pieces tracked</span><strong>{{s.items_total}}</strong></article><article><span>Lifetime estimate</span><strong>{{customerValue() | currency:'INR':'symbol':'1.0-0'}}</strong></article></div> }

  <div class="customer-workspace">
    <section class="customer-orders-panel">
      <div class="customer-section-heading"><div><span class="customer-eyebrow">ATELIER RECORD</span><h2>Jewellery &amp; orders</h2><p>Pieces and workshop progress for this customer.</p></div><button class="btn secondary small" (click)="loadOrders()">Refresh</button></div>
      @if (ordersLoading()) { <div class="card empty"><div class="spinner"></div><p class="muted">Loading orders…</p></div> }
      @else if (!orders().length) { <div class="card customer-empty"><span class="customer-empty-icon">✧</span><h3>No orders yet</h3><p>Create the first order to start tracking this customer’s jewellery.</p><button class="btn primary" [routerLink]="['/orders/new']" [queryParams]="{customer_id:c.id}">＋ Create first order</button></div> }
      @else { @for (o of orders(); track o.id) {
        <article class="customer-order-card"><div class="customer-order-heading"><div><span class="customer-eyebrow">{{o.created_at | date:'d MMM yyyy'}} · {{o.order_number}}</span><h3>{{o.items.length}} {{o.items.length===1?'piece':'pieces'}}</h3></div><app-status-badge [status]="o.status"/></div>
          <div class="customer-piece-list">@for (item of o.items; track item.id) { <a class="customer-piece-row" [routerLink]="['/orders',o.id]"><span class="customer-piece-icon">{{pieceSymbol(item.item_type)}}</span><span class="customer-piece-copy"><strong>{{item.item_type}}{{item.design?' · '+item.design:''}}</strong><small>{{item.gold_purity||'Custom'}}@if (item.net_weight_g) { · {{item.net_weight_g}} g} · Qty {{item.quantity}}</small></span><app-status-badge [status]="item.status"/><span class="customer-piece-value">{{item.estimated_value | currency:'INR':'symbol':'1.0-0'}}</span></a> } @empty { <p class="muted">No pieces recorded for this order.</p> }</div>
          <div class="customer-order-footer"><span>Expected delivery <strong>{{o.expected_delivery_date ? (o.expected_delivery_date | date:'d MMM yyyy') : 'To be confirmed'}}</strong></span><span>Estimate <strong>{{o.total_estimated_value | currency:'INR':'symbol':'1.0-0'}}</strong></span><a [routerLink]="['/orders',o.id]">Open order →</a></div>
        </article>
      } }
    </section>
    <aside class="customer-side-panels">
      <section class="card customer-info-panel"><div class="customer-section-heading"><div><span class="customer-eyebrow">CLIENT PROFILE</span><h2>Customer information</h2></div><span class="customer-profile-avatar small-avatar">{{initials(c.name)}}</span></div><dl class="customer-info-list"><div><dt>Mobile</dt><dd><a [href]="'tel:'+c.phone">{{c.phone}}</a></dd></div><div><dt>Email</dt><dd>{{c.email||'—'}}</dd></div><div><dt>Address</dt><dd>{{c.address||'—'}}</dd></div><div><dt>Customer since</dt><dd>{{c.created_at | date:'d MMM yyyy'}}</dd></div><div><dt>WhatsApp updates</dt><dd><span class="customer-consent" [class.consent-on]="c.whatsapp_opt_in">{{c.whatsapp_opt_in?'Opted in':'Not opted in'}}</span></dd></div>@if(c.notes){<div><dt>Notes</dt><dd>{{c.notes}}</dd></div>}</dl><button class="btn secondary customer-message-button" (click)="openMessage()" [disabled]="!c.whatsapp_opt_in">Send WhatsApp message</button></section>
      <section class="card customer-summary-panel"><span class="customer-eyebrow">ORDER SUMMARY</span><h2>Workshop overview</h2>@if (summary(); as s) {<div class="customer-summary-line"><span>Pending pieces</span><strong>{{s.items_pending}}</strong></div><div class="customer-summary-line"><span>Ready pieces</span><strong>{{s.items_ready}}</strong></div><div class="customer-summary-line"><span>Delivered pieces</span><strong>{{s.items_delivered}}</strong></div><div class="customer-summary-line total-line"><span>Total estimated orders</span><strong>{{customerValue() | currency:'INR':'symbol':'1.0-0'}}</strong></div>} @else {<p class="muted">Loading summary…</p>}</section>
    </aside>
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

  initials(name:string){return (name||'C').trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('');}
  pieceSymbol(type:string){const value=(type||'').toLowerCase();if(value.includes('ring'))return '◉';if(value.includes('earring'))return '⌁';if(value.includes('chain')||value.includes('necklace'))return '〰';if(value.includes('bangle')||value.includes('bracelet'))return '◎';if(value.includes('pendant'))return '♢';return '✧';}
  customerValue(){return this.orders().reduce((sum,order)=>sum+(order.total_estimated_value||0),0);}

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
