import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient,HttpParams} from '@angular/common/http';
import {Notification,Customer} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {PaginationComponent} from '../../shared/pagination.component';
import {ToastService} from '../../shared/toast.service';
import {RouterLink} from '@angular/router';

const NOTIFICATION_TYPES=['ORDER_CREATED','ORDER_IN_PROGRESS','ORDER_READY','ORDER_DELIVERED','CUSTOM'];

@Component({selector:'app-notifications',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,PaginationComponent,RouterLink],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Notifications</h1>
    <p class="page-sub">WhatsApp message queue — sent, queued and failed notifications</p>
  </div>
  <button class="btn secondary" (click)="load()" [disabled]="loading()">Refresh</button>
</div>

<div class="card filter-bar">
  <select class="input" [ngModel]="status" (ngModelChange)="onFilter('status',$event)">
    <option value="">All statuses</option>
    <option value="QUEUED">Queued</option>
    <option value="SENT">Sent</option>
    <option value="FAILED">Failed</option>
  </select>
  <select class="input" [ngModel]="type" (ngModelChange)="onFilter('type',$event)">
    <option value="">All types</option>
    @for (t of NOTIFICATION_TYPES; track t) { <option [value]="t">{{t}}</option> }
  </select>
  <input class="input" placeholder="Customer name…" [(ngModel)]="customerQuery" (keyup.enter)="applyCustomerFilter()">
  <input class="input" placeholder="Order id…" type="number" [ngModel]="orderId" (ngModelChange)="onOrderId($event)">
  <button class="btn secondary small" (click)="advanced.set(!advanced())">{{advanced() ? 'Hide dates' : 'Date filters'}}</button>
</div>

@if (advanced()) {
  <div class="card filter-bar advanced">
    <div class="filter-group">
      <label>Created from</label>
      <input class="input" type="date" [ngModel]="createdFrom" (ngModelChange)="onDate('created_from',$event)">
    </div>
    <div class="filter-group">
      <label>Created to</label>
      <input class="input" type="date" [ngModel]="createdTo" (ngModelChange)="onDate('created_to',$event)">
    </div>
    <button class="btn secondary small" (click)="clearFilters()">Clear</button>
  </div>
}

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading notifications…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (!notifications().length) {
  <div class="card empty"><p class="muted">No notifications found.</p></div>
} @else {
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Type</th><th>Customer</th><th>Order</th><th>Channel</th><th>Status</th><th>Created</th><th>Sent</th><th>Error</th><th>Actions</th></tr></thead>
        <tbody>
          @for (n of notifications(); track n.id) {
            <tr>
              <td><span class="badge badge-default">{{n.type||'CUSTOM'}}</span></td>
              <td>{{n.customer?.name||n.customer_id}}</td>
              <td>@if (n.order_id) { <a class="link" [routerLink]="['/orders',n.order_id]">{{n.order_number||('#'+n.order_id)}}</a> } @else { — }</td>
              <td class="muted">{{n.channel}}</td>
              <td><app-status-badge [status]="n.status"/></td>
              <td class="muted">{{n.created_at | date:'short'}}</td>
              <td class="muted">{{n.sent_at | date:'short'}}</td>
              <td class="error notif-error-cell">{{n.error||'—'}}</td>
              <td class="actions-cell">
                @if (n.status==='FAILED') {
                  <button class="btn primary small" (click)="retry(n)">Retry</button>
                } @else {
                  <span class="muted small-label">{{n.retry_count}} retries</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <app-pagination [page]="page()" [size]="pageSize" [total]="total()" (pageChange)="goTo($event)"/>
  </div>
}
`})
export class NotificationsComponent implements OnInit{
  private http=inject(HttpClient);
  private toast=inject(ToastService);
  readonly NOTIFICATION_TYPES=NOTIFICATION_TYPES;

  readonly notifications=signal<Notification[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly total=signal(0);
  readonly page=signal(1);
  readonly advanced=signal(false);
  pageSize=50;
  status=''; type=''; customerQuery=''; orderId:number|null=null;
  createdFrom=''; createdTo='';
  private customerFilterId:number|null=null;

  ngOnInit(){this.load();}

  onFilter(key:'status'|'type',value:string){
    if(key==='status') this.status=value||'';
    else this.type=value||'';
    this.page.set(1); this.load();
  }

  onOrderId(value:string|null){this.orderId=value==null||value===''?null:Number(value);this.page.set(1);this.load();}

  onDate(key:'created_from'|'created_to',value:string){
    if(key==='created_from') this.createdFrom=value||'';
    else this.createdTo=value||'';
    this.page.set(1); this.load();
  }

  applyCustomerFilter(){
    const q=this.customerQuery.trim();
    if(!q){this.customerFilterId=null;this.page.set(1);this.load();return;}
    this.http.get<Customer[]>('/api/customers',{params:{q,limit:'1'}}).subscribe({
      next:list=>{
        const match=list[0];
        if(!match){this.toast.error('No customer matches that name.');return;}
        this.customerFilterId=match.id;
        this.page.set(1);
        this.load();
      },
      error:()=>this.toast.error('Could not search customers.')
    });
  }

  clearFilters(){
    this.status=''; this.type=''; this.customerQuery=''; this.orderId=null;
    this.createdFrom=''; this.createdTo=''; this.customerFilterId=null;
    this.page.set(1); this.load();
  }

  goTo(page:number){this.page.set(page);this.load();}

  load(){
    this.loading.set(true); this.error.set('');
    let params=new HttpParams().set('skip',(this.page()-1)*this.pageSize).set('limit',this.pageSize);
    if(this.status) params=params.set('status',this.status);
    if(this.type) params=params.set('type',this.type);
    if(this.customerFilterId) params=params.set('customer_id',String(this.customerFilterId));
    if(this.orderId) params=params.set('order_id',String(this.orderId));
    if(this.createdFrom) params=params.set('created_from',this.createdFrom);
    if(this.createdTo) params=params.set('created_to',this.createdTo);
    this.http.get<Notification[]>('/api/notifications',{params,observe:'response'}).subscribe({
      next:res=>{
        this.notifications.set(res.body||[]);
        const total=res.headers.get('X-Total-Count');
        this.total.set(total?Number(total):(res.body||[]).length);
        this.loading.set(false);
      },
      error:err=>{this.loading.set(false);this.error.set(this.message(err,'Could not load notifications.'));}
    });
  }

  retry(n:Notification){
    this.http.post(`/api/notifications/${n.id}/retry`,{}).subscribe({
      next:()=>{this.toast.success('Notification re-queued.');this.load();},
      error:err=>{this.toast.error(this.message(err,'Could not retry the notification.'));}
    });
  }

  private message(err:unknown,fallback:string):string{
    const detail=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof detail==='string'?detail:fallback;
  }
}
