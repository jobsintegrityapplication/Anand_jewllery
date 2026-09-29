import {Component,inject,signal,computed,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {Router,RouterLink} from '@angular/router';
import {DashboardSummary} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {ToastService} from '../../shared/toast.service';

@Component({selector:'app-dashboard',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,RouterLink],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Dashboard</h1>
    <p class="page-sub">Business overview for Anand Jewellers</p>
  </div>
  <button class="btn secondary" (click)="load()" [disabled]="loading()">Refresh</button>
</div>

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading dashboard…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (summary(); as s) {
  <div class="kpi-grid">
    <div class="card kpi"><div class="kpi-value">{{s.customers_total}}</div><div class="kpi-label">Total Customers</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.orders_total}}</div><div class="kpi-label">Total Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.orders_open}}</div><div class="kpi-label">Open Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.orders_in_progress + s.orders_partially_ready}}</div><div class="kpi-label">In Progress</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.orders_ready}}</div><div class="kpi-label">Ready Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.orders_delivered}}</div><div class="kpi-label">Delivered Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.items_pending}}</div><div class="kpi-label">Pending Items</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.items_ready}}</div><div class="kpi-label">Ready Items</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.notifications_queued}}</div><div class="kpi-label">WhatsApp Queued</div></div>
    <div class="card kpi"><div class="kpi-value">{{s.notifications_failed}}</div><div class="kpi-label">WhatsApp Failed</div></div>
  </div>

  <div class="grid dash-grid">
    <div class="card span-2">
      <div class="card-head">
        <h2 class="card-title">Recent Orders</h2>
        <a class="btn secondary small" routerLink="/orders">View all</a>
      </div>
      @if (s.recent_orders.length) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              @for (o of s.recent_orders; track o.id) {
                <tr>
                  <td><a class="link" [routerLink]="['/orders',o.id]">{{o.order_number}}</a></td>
                  <td>{{o.customer?.name}}</td>
                  <td>{{o.items.length}}</td>
                  <td><app-status-badge [status]="o.status"/></td>
                  <td class="muted">{{o.created_at | date:'mediumDate'}}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="empty"><p class="muted">No orders yet. Create an order to start tracking jewellery work.</p><button class="btn primary" routerLink="/orders/new">Create Order</button></div>
      }
    </div>

    <div class="card">
      <h2 class="card-title">Order Status Distribution</h2>
      @if (statusRows().length) {
        <div class="dist">
          @for (row of statusRows(); track row.status) {
            <div class="dist-row">
              <span class="dist-label"><app-status-badge [status]="row.status"/></span>
              <span class="dist-track"><span class="dist-bar" [style.width.%]="row.pct"></span></span>
              <span class="dist-count">{{row.count}}</span>
            </div>
          }
        </div>
      } @else { <p class="muted">No orders yet.</p> }
      <h2 class="card-title dist-title">Orders — Last 14 Days</h2>
      @if (overTimeMax() > 0) {
        <div class="dist">
          @for (b of s.orders_over_time; track b.date) {
            <div class="dist-row">
              <span class="dist-label muted small-label">{{b.date | date:'MMM d'}}</span>
              <span class="dist-track"><span class="dist-bar gold" [style.width.%]="(b.count / overTimeMax()) * 100"></span></span>
              <span class="dist-count">{{b.count}}</span>
            </div>
          }
        </div>
      } @else { <p class="muted">No orders in the last 14 days.</p> }
    </div>
  </div>

  <div class="grid dash-grid">
    <div class="card">
      <h2 class="card-title">Quick Actions</h2>
      <div class="row">
        <button class="btn primary" routerLink="/customers" [queryParams]="{new:1}">Add Customer</button>
        <button class="btn primary" routerLink="/orders/new">Create Order</button>
        <button class="btn secondary" routerLink="/orders">View Orders</button>
      </div>
      <div class="field search-field">
        <label for="dash-q">Search Customer</label>
        <input id="dash-q" class="input" placeholder="Name or phone…" [(ngModel)]="search" (keyup.enter)="goSearch()">
      </div>
      @if (search) { <button class="btn secondary small" (click)="goSearch()">Search</button> }
    </div>

    <div class="card">
      <h2 class="card-title">Recent Customers</h2>
      @if (s.recent_customers.length) {
        <ul class="list">
          @for (c of s.recent_customers; track c.id) {
            <li class="list-row">
              <a class="link" [routerLink]="['/customers',c.id]">{{c.name}}</a>
              <span class="muted">{{c.phone}}</span>
              @if (c.whatsapp_opt_in) { <span class="badge badge-sent">WhatsApp</span> }
            </li>
          }
        </ul>
      } @else { <p class="muted">No customers yet. Add your first customer.</p> }
    </div>

    <div class="card">
      <h2 class="card-title">Low Stock</h2>
      @if (s.low_stock.length) {
        <ul class="list">
          @for (p of s.low_stock; track p.id) {
            <li class="list-row">
              <span>{{p.name}}</span>
              <span class="muted">{{p.sku}}</span>
              <span class="pill low">{{p.available_quantity}} left</span>
            </li>
          }
        </ul>
      } @else { <p class="muted">No low-stock items.</p> }
    </div>
  </div>
}
`,providers:[]})
export class DashboardComponent implements OnInit{
  private http=inject(HttpClient);
  private router=inject(Router);
  private toast=inject(ToastService);
  readonly summary=signal<DashboardSummary|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');
  search='';

  readonly statusRows=computed(()=>{
    const s=this.summary();
    if(!s) return [];
    const entries=Object.entries(s.orders_by_status);
    const max=Math.max(1,...entries.map(e=>e[1]));
    return entries.sort((a,b)=>b[1]-a[1]).map(([status,count])=>({status,count,pct:Math.round((count/max)*100)}));
  });
  readonly overTimeMax=computed(()=>{
    const s=this.summary();
    if(!s) return 0;
    return Math.max(0,...s.orders_over_time.map(b=>b.count));
  });

  ngOnInit(){this.load();}

  load(){
    this.loading.set(true); this.error.set('');
    this.http.get<DashboardSummary>('/api/dashboard/summary').subscribe({
      next:s=>{this.summary.set(s);this.loading.set(false);},
      error:err=>{this.loading.set(false);this.error.set(this.message(err));}
    });
  }

  goSearch(){
    const q=this.search.trim();
    if(!q) return;
    this.router.navigate(['/customers'],{queryParams:{q}});
  }

  private message(err:unknown):string{
    const detail=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof detail==='string'?detail:'Could not load dashboard. Check that the backend is running.';
  }
}
