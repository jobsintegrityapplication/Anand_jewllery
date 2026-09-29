import {Component,inject,signal,computed,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ReportSummary} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';

@Component({selector:'app-reports',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Reports</h1>
    <p class="page-sub">Orders, customers and notification performance</p>
  </div>
  <button class="btn secondary" (click)="load()" [disabled]="loading()">Refresh</button>
</div>

<div class="card filter-bar">
  <select class="input" [ngModel]="period" (ngModelChange)="onPeriod($event)">
    <option value="today">Today</option>
    <option value="7d">Last 7 days</option>
    <option value="30d">Last 30 days</option>
    <option value="month">This month</option>
    <option value="custom">Custom range</option>
  </select>
  @if (period==='custom') {
    <input class="input" type="date" [(ngModel)]="customFrom" (ngModelChange)="load()">
    <input class="input" type="date" [(ngModel)]="customTo" (ngModelChange)="load()">
  }
</div>

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading reports…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (report(); as r) {
  <div class="kpi-grid">
    <div class="card kpi"><div class="kpi-value">{{r.orders_total}}</div><div class="kpi-label">Orders in period</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.orders_pending}}</div><div class="kpi-label">Pending Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.orders_ready}}</div><div class="kpi-label">Ready Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.orders_delivered}}</div><div class="kpi-label">Delivered Orders</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.customers_new}}</div><div class="kpi-label">New Customers</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.repeat_customers}}</div><div class="kpi-label">Repeat Customers</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.notifications_success}}</div><div class="kpi-label">Notifications Sent</div></div>
    <div class="card kpi"><div class="kpi-value">{{r.notifications_failed}}</div><div class="kpi-label">Notifications Failed</div></div>
  </div>

  <div class="grid dash-grid">
    <div class="card">
      <h2 class="card-title">Orders by Status</h2>
      @if (statusRows().length) {
        <table class="table">
          <thead><tr><th>Status</th><th>Orders</th></tr></thead>
          <tbody>
            @for (row of statusRows(); track row.status) {
              <tr><td><app-status-badge [status]="row.status"/></td><td>{{row.count}}</td></tr>
            }
          </tbody>
        </table>
      } @else { <p class="muted">No orders in this period.</p> }

      <h2 class="card-title dist-title">Items by Status</h2>
      @if (itemRows().length) {
        <table class="table">
          <thead><tr><th>Status</th><th>Items</th></tr></thead>
          <tbody>
            @for (row of itemRows(); track row.status) {
              <tr><td><app-status-badge [status]="row.status"/></td><td>{{row.count}}</td></tr>
            }
          </tbody>
        </table>
      } @else { <p class="muted">No items in this period.</p> }
    </div>

    <div class="card">
      <h2 class="card-title">Orders Over Time</h2>
      @if (r.orders_by_date.length) {
        <div class="dist">
          @for (b of bars(r.orders_by_date); track b.date) {
            <div class="dist-row">
              <span class="dist-label muted small-label">{{b.date | date:'MMM d'}}</span>
              <span class="dist-track"><span class="dist-bar gold" [style.width.%]="b.pct"></span></span>
              <span class="dist-count">{{b.count}}</span>
            </div>
          }
        </div>
      } @else { <p class="muted">No orders in this period.</p> }

      <h2 class="card-title dist-title">Customer Growth</h2>
      @if (r.customer_growth.length) {
        <div class="dist">
          @for (b of bars(r.customer_growth); track b.date) {
            <div class="dist-row">
              <span class="dist-label muted small-label">{{b.date | date:'MMM d'}}</span>
              <span class="dist-track"><span class="dist-bar" [style.width.%]="b.pct"></span></span>
              <span class="dist-count">{{b.count}}</span>
            </div>
          }
        </div>
      } @else { <p class="muted">No new customers in this period.</p> }
    </div>
  </div>
}
`})
export class ReportsComponent implements OnInit{
  private http=inject(HttpClient);
  period='30d';
  customFrom=''; customTo='';
  readonly report=signal<ReportSummary|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');

  readonly statusRows=computed(()=>{
    const r=this.report();
    if(!r) return [];
    return Object.entries(r.orders_by_status).sort((a,b)=>b[1]-a[1]).map(([status,count])=>({status,count}));
  });
  readonly itemRows=computed(()=>{
    const r=this.report();
    if(!r) return [];
    return Object.entries(r.items_by_status).sort((a,b)=>b[1]-a[1]).map(([status,count])=>({status,count}));
  });

  ngOnInit(){this.load();}

  onPeriod(value:string){this.period=value;this.load();}

  bars(rows:{date:string;count:number}[]){
    const max=Math.max(1,...rows.map(r=>r.count));
    return rows.map(r=>({...r,pct:Math.round((r.count/max)*100)}));
  }

  load(){
    this.loading.set(true); this.error.set('');
    const params:Record<string,string>={period:this.period};
    if(this.period==='custom'){
      params['custom_from']=this.customFrom;
      params['custom_to']=this.customTo;
    }
    this.http.get<ReportSummary>('/api/reports/summary',{params}).subscribe({
      next:r=>{this.report.set(r);this.loading.set(false);},
      error:err=>{
        this.loading.set(false);
        const detail=(err as {error?:{detail?:string}})?.error?.detail;
        this.error.set(typeof detail==='string'?detail:'Could not load reports.');
      }
    });
  }
}
