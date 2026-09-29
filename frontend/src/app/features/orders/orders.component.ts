import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient,HttpParams} from '@angular/common/http';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Order,ORDER_STATUSES} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {PaginationComponent} from '../../shared/pagination.component';
import {ToastService} from '../../shared/toast.service';

@Component({selector:'app-orders',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,PaginationComponent,RouterLink],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Orders</h1>
    <p class="page-sub">Track customer orders and jewellery work</p>
  </div>
  <button class="btn primary" routerLink="/orders/new">Create Order</button>
</div>

<div class="card filter-bar">
  <input class="input grow" placeholder="Search by order number, customer or phone…" [ngModel]="q" (ngModelChange)="onSearch($event)">
  <select class="input" [ngModel]="status" (ngModelChange)="onStatus($event)">
    <option value="">All statuses</option>
    @for (s of ORDER_STATUSES; track s) { <option [value]="s">{{s}}</option> }
  </select>
  <select class="input" [ngModel]="sort" (ngModelChange)="onSort($event)">
    <option value="id_desc">Newest first</option>
    <option value="id_asc">Oldest first</option>
    <option value="created_desc">Created ↓</option>
    <option value="created_asc">Created ↑</option>
  </select>
  <button class="btn secondary" type="button" (click)="advanced.set(!advanced())">{{advanced() ? 'Hide filters' : 'More filters'}}</button>
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
    <div class="filter-group">
      <label>Expected from</label>
      <input class="input" type="date" [ngModel]="expectedFrom" (ngModelChange)="onDate('expected_from',$event)">
    </div>
    <div class="filter-group">
      <label>Expected to</label>
      <input class="input" type="date" [ngModel]="expectedTo" (ngModelChange)="onDate('expected_to',$event)">
    </div>
    <div class="filter-group">
      <label>Per page</label>
      <select class="input" [ngModel]="pageSize" (ngModelChange)="onPageSize($event)">
        <option [ngValue]="25">25</option>
        <option [ngValue]="50">50</option>
        <option [ngValue]="100">100</option>
      </select>
    </div>
    <button class="btn secondary small" (click)="clearFilters()">Clear</button>
  </div>
}

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading orders…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (!orders().length) {
  <div class="card empty">
    <p class="muted">No orders yet. Create an order to start tracking jewellery work.</p>
    <button class="btn primary" routerLink="/orders/new">Create Order</button>
  </div>
} @else {
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Items</th><th>Status</th><th>Expected</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          @for (o of orders(); track o.id) {
            <tr>
              <td><a class="link" [routerLink]="['/orders',o.id]">{{o.order_number}}</a></td>
              <td><a class="link" [routerLink]="['/customers',o.customer_id]">{{o.customer?.name}}</a></td>
              <td class="muted">{{o.customer?.phone}}</td>
              <td>{{o.items.length}}</td>
              <td><app-status-badge [status]="o.status"/></td>
              <td class="muted">{{o.expected_delivery_date | date:'mediumDate'}}</td>
              <td class="muted">{{o.created_at | date:'mediumDate'}}</td>
              <td class="actions-cell">
                <a class="btn secondary small" [routerLink]="['/orders',o.id]">View</a>
                @if (terminal(o.status)) {
                  <span class="muted small-label">Final</span>
                } @else {
                  <select class="input select-small" [ngModel]="o.status" (ngModelChange)="updateStatus(o,$event)">
                    @for (s of nextStatuses(o.status); track s) { <option [value]="s">{{s}}</option> }
                  </select>
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
export class OrdersComponent implements OnInit{
  private http=inject(HttpClient);
  private route=inject(ActivatedRoute);
  private router=inject(Router);
  private toast=inject(ToastService);
  readonly ORDER_STATUSES=ORDER_STATUSES;

  private readonly TRANSITIONS:Record<string,string[]>={
    'OPEN':['IN_PROGRESS','READY','DELIVERED','CANCELLED'],
    'IN_PROGRESS':['PARTIALLY_READY','READY','DELIVERED','CANCELLED'],
    'PARTIALLY_READY':['READY','IN_PROGRESS','DELIVERED','CANCELLED'],
    'READY':['DELIVERED','IN_PROGRESS','PARTIALLY_READY','CANCELLED'],
    'DELIVERED':[],
    'CANCELLED':[],
  };

  readonly orders=signal<Order[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly total=signal(0);
  readonly page=signal(1);
  readonly advanced=signal(false);
  pageSize=50;
  q=''; status=''; sort='id_desc';
  createdFrom=''; createdTo=''; expectedFrom=''; expectedTo='';

  ngOnInit(){
    this.route.queryParamMap.subscribe(params=>{
      const q=params.get('q');
      if(q!==null){this.q=q;}
      this.page.set(1);
      this.load();
    });
  }

  terminal(status:string){return this.TRANSITIONS[status]?.length===0;}

  nextStatuses(status:string){return this.TRANSITIONS[status]||[];}

  onSearch(value:string){this.q=value;this.page.set(1);this.load();}

  onStatus(value:string){this.status=value||'';this.page.set(1);this.load();}

  onSort(value:string){this.sort=value||'id_desc';this.page.set(1);this.load();}

  onDate(key:'created_from'|'created_to'|'expected_from'|'expected_to',value:string){
    if(key==='created_from') this.createdFrom=value||'';
    else if(key==='created_to') this.createdTo=value||'';
    else if(key==='expected_from') this.expectedFrom=value||'';
    else this.expectedTo=value||'';
    this.page.set(1); this.load();
  }

  onPageSize(value:number){this.pageSize=Number(value)||50;this.page.set(1);this.load();}

  goTo(page:number){this.page.set(page);this.load();}

  clearFilters(){
    this.q=''; this.status=''; this.sort='id_desc';
    this.createdFrom=''; this.createdTo=''; this.expectedFrom=''; this.expectedTo='';
    this.page.set(1); this.load();
  }

  load(){
    this.loading.set(true); this.error.set('');
    let params=new HttpParams()
      .set('q',this.q)
      .set('skip',(this.page()-1)*this.pageSize)
      .set('limit',this.pageSize)
      .set('sort',this.sort);
    if(this.status) params=params.set('status',this.status);
    if(this.createdFrom) params=params.set('created_from',this.createdFrom);
    if(this.createdTo) params=params.set('created_to',this.createdTo);
    if(this.expectedFrom) params=params.set('expected_from',this.expectedFrom);
    if(this.expectedTo) params=params.set('expected_to',this.expectedTo);
    this.http.get<Order[]>('/api/orders',{params,observe:'response'}).subscribe({
      next:res=>{
        this.orders.set(res.body||[]);
        const total=res.headers.get('X-Total-Count');
        this.total.set(total?Number(total):(res.body||[]).length);
        this.loading.set(false);
      },
      error:err=>{this.loading.set(false);this.error.set(this.message(err,'Could not load orders.'));}
    });
  }

  updateStatus(order:Order,target:string){
    if(!target||target===order.status) return;
    this.http.patch<Order>(`/api/orders/${order.id}`,{status:target}).subscribe({
      next:()=>{this.toast.success(`Order ${order.order_number} marked ${target}.`);this.load();},
      error:err=>{this.toast.error(this.message(err,'Could not update the order status.'));this.load();}
    });
  }

  private message(err:unknown,fallback:string):string{
    const detail=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof detail==='string'?detail:fallback;
  }
}
