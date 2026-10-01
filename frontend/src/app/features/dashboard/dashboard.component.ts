import {Component,inject,signal,computed,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {Router,RouterLink} from '@angular/router';
import {Customer,DashboardSummary} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {ToastService} from '../../shared/toast.service';

@Component({selector:'app-dashboard',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,RouterLink],template:`
<section class="atelier-dashboard">
  @if (loading()) {
    <div class="glass-panel empty"><div class="spinner"></div><p>Preparing your atelier overview…</p></div>
  } @else if (error()) {
    <div class="glass-panel empty"><p class="error">{{error()}}</p><button class="btn primary" (click)="load()">Try again</button></div>
  } @else if (summary(); as s) {
    <div class="welcome-row">
      <div><span class="section-kicker">CLIENT WORKSPACE</span><h1>Orders, made personal.</h1><p>Every detail, thoughtfully in progress.</p></div>
      <div class="welcome-actions">
        <div class="dashboard-search-wrap">
          <label class="search-box"><span>⌕</span><input aria-label="Search customers" placeholder="Find a customer by name or mobile" autocomplete="off" role="combobox" [attr.aria-expanded]="suggestOpen()" [(ngModel)]="search" (ngModelChange)="suggestCustomers($event)" (keyup.enter)="goSearch()" (blur)="hideSuggestions()"><kbd>↵</kbd></label>
          <div class="dashboard-suggestions" *ngIf="suggestOpen()">
            <button type="button" *ngFor="let customer of customerSuggestions()" (mousedown)="$event.preventDefault()" (click)="openCustomer(customer)"><strong>{{customer.name}}</strong><small>{{customer.phone}}</small></button>
          </div>
        </div>
        <div class="dashboard-quick-actions"><a class="btn secondary" routerLink="/customers">Add customer</a><a class="btn primary" routerLink="/orders/new"><span>＋</span> New order</a><a class="btn secondary" routerLink="/orders">View orders</a></div>
      </div>
    </div>

    <section class="month-overview glass-panel">
      <div class="month-overview-head"><div><span class="section-kicker">MONTHLY SNAPSHOT</span><h2>{{monthLabel()}}</h2></div><label class="month-picker">Month<input class="input" type="month" [(ngModel)]="month" (ngModelChange)="load()"></label><button class="btn secondary small" type="button" (click)="load()">Refresh</button></div>
      <p class="month-saved muted" *ngIf="s.saved_at">Saved for {{s.month}} at {{s.saved_at | date:'medium'}}</p>
      <div class="month-kpis">
        <article><span>Total customers</span><strong>{{s.customers_total}}</strong></article>
        <article><span>Total orders</span><strong>{{s.orders_total}}</strong></article>
        <article><span>Open orders</span><strong>{{s.orders_open}}</strong></article>
        <article><span>Ready orders</span><strong>{{s.orders_ready}}</strong></article>
        <article><span>Delivered</span><strong>{{s.orders_delivered}}</strong></article>
        <article><span>Pending items</span><strong>{{s.items_pending}}</strong></article>
        <article><span>Ready items</span><strong>{{s.items_ready}}</strong></article>
        <article><span>WhatsApp queued / failed</span><strong>{{s.notifications_queued}} / {{s.notifications_failed}}</strong></article>
      </div>
    </section>

    <div class="hero-panel glass-panel">
      @if (s.recent_orders[0]; as order) {
        <div class="hero-client">
          <div class="customer-avatar">{{(order.customer?.name || 'C').slice(0,1).toUpperCase()}}</div>
          <div class="hero-client-copy"><span class="section-kicker">LATEST CLIENT ORDER</span><h2>{{order.customer?.name || 'Customer'}}</h2><a [routerLink]="['/orders',order.id]">{{order.order_number}} <span>↗</span></a></div>
        </div>
        <div class="hero-stats">
          <div class="stat-block"><span class="stat-ring gold-ring">✧</span><span><small>OPEN ORDERS</small><strong>{{s.orders_open + s.orders_in_progress + s.orders_partially_ready}}</strong></span></div>
          <div class="hero-wave" aria-label="Orders created during the selected month"><span *ngFor="let b of s.orders_over_time; let i=index" [attr.title]="b.date + ': ' + b.count + ' orders'" [style.height.%]="barHeight(b.count)" [class.wave-highlight]="i===s.orders_over_time.length-1"></span></div>
          <div class="stat-block"><span class="stat-ring blue-ring">◇</span><span><small>READY PIECES</small><strong>{{s.items_ready}} <em>pieces</em></strong></span></div>
        </div>
        <button class="icon-action refresh-action" type="button" aria-label="Refresh dashboard" (click)="load()">↻</button>
      } @else {
        <div class="empty-order"><span class="section-kicker">WELCOME TO YOUR ATELIER</span><h2>Your next beautiful piece begins here.</h2><p>Create an order to start tracking the customer journey, workshop progress, and delivery in one place.</p><button class="btn primary" routerLink="/orders/new">＋ Create first order</button></div>
      }
    </div>

    <div class="workspace-grid">
      <section class="pieces-section">
        <div class="section-heading"><div><span class="section-kicker">THE WORKSHOP</span><h2>Jewellery pieces</h2></div><a class="text-link" routerLink="/orders">All orders <span>↗</span></a></div>
        @if (s.recent_orders[0]; as order) {
          @if (order.items.length) {
            <div class="pieces-grid">
              @for (item of order.items; track item.id) {
                <a class="piece-card" [class.piece-gold]="item.item_type.toLowerCase().includes('gold') || item.item_type.toLowerCase().includes('chain') || item.item_type.toLowerCase().includes('bangle')" [routerLink]="['/orders',order.id]">
                  <div class="piece-top"><span class="piece-symbol">{{pieceSymbol(item.item_type)}}</span><app-status-badge [status]="item.status"/></div>
                  <div class="piece-name">{{item.item_type}}</div><div class="piece-code">{{item.item_code}} <span *ngIf="item.quantity > 1">· Qty {{item.quantity}}</span></div>
                  <div class="piece-divider"></div><div class="piece-details"><span>DESCRIPTION</span><strong>{{item.description || 'Made to measure'}}</strong></div>
                  <div class="piece-meta"><span>EXPECTED</span><strong>{{item.expected_date ? (item.expected_date | date:'d MMM yyyy') : 'To be confirmed'}}</strong></div>
                  @if (item.estimated_value) { <div class="piece-meta"><span>ESTIMATED VALUE</span><strong>{{item.estimated_value | currency:'INR':'symbol':'1.0-0'}}</strong></div> }
                  <div class="piece-footer">View piece <span>→</span></div>
                </a>
              }
            </div>
          } @else {
            <div class="glass-panel empty-pieces"><p>This order has no pieces yet.</p><a class="text-link" [routerLink]="['/orders',order.id]">Add pieces to this order <span>→</span></a></div>
          }
        } @else {
          <div class="glass-panel empty-pieces"><p>Your workshop is ready for its first order.</p><button class="btn secondary" routerLink="/orders/new">Create an order</button></div>
        }
        <div class="overview-strip glass-panel"><div><span class="section-kicker">YOUR ATELIER AT A GLANCE</span><strong>{{s.orders_total}} <small>total orders</small></strong></div><div><strong>{{s.customers_total}}</strong><small>valued clients</small></div><div><strong>{{s.items_pending}}</strong><small>pieces in workshop</small></div><div><strong>{{s.notifications_queued}}</strong><small>messages queued</small></div></div>
      </section>

      <aside class="order-aside">
        @if (s.recent_orders[0]; as order) {
          <section class="glass-panel summary-panel"><div class="side-heading"><div><span class="section-kicker">AT A GLANCE</span><h2>Order summary</h2></div><app-status-badge [status]="order.status"/></div>
            <dl class="summary-list"><div><dt>Order date</dt><dd>{{order.created_at | date:'d MMM yyyy'}}</dd></div><div><dt>Pieces</dt><dd>{{order.items.length}} pieces</dd></div><div><dt>Estimated value</dt><dd>{{orderValue(order.items) | currency:'INR':'symbol':'1.0-0'}}</dd></div><div><dt>Next delivery</dt><dd>{{nextDelivery(order.items)}}</dd></div></dl>
            <div class="progress-head"><span>Workshop progress</span><strong>{{completion(order.items)}}%</strong></div><div class="progress-track"><span [style.width.%]="completion(order.items)"></span></div>
            <a class="aside-link" [routerLink]="['/orders',order.id]">Open order details <span>→</span></a>
          </section>
          <section class="glass-panel customer-panel"><div class="side-heading"><div><span class="section-kicker">A PERSONAL TOUCH</span><h2>Client details</h2></div><span class="customer-mini-avatar">{{(order.customer?.name || 'C').slice(0,1).toUpperCase()}}</span></div>
            <a class="customer-name" [routerLink]="['/customers',order.customer_id]">{{order.customer?.name || 'Customer'}} <span>↗</span></a>
            <a class="contact-line" [href]="'tel:' + order.customer?.phone">⌕ <span>{{order.customer?.phone || 'No phone on file'}}</span></a>
            @if (order.customer?.email) { <a class="contact-line" [href]="'mailto:' + order.customer?.email">✉ <span>{{order.customer?.email}}</span></a> }
            <div class="contact-preference"><span>WhatsApp updates</span><span class="preference-value" [class.opted-in]="order.customer?.whatsapp_opt_in">{{order.customer?.whatsapp_opt_in ? 'Opted in' : 'Not opted in'}}</span></div>
          </section>
        } @else {
          <section class="glass-panel summary-panel"><span class="section-kicker">AT A GLANCE</span><h2>Order summary</h2><p class="aside-empty">Your latest order details will appear here.</p></section>
        }
        <section class="glass-panel stock-panel"><div class="side-heading"><div><span class="section-kicker">THE SHOWCASE</span><h2>Stock to watch</h2></div><a class="text-link" routerLink="/products">View <span>↗</span></a></div>
          @if (s.low_stock.length) { @for (p of s.low_stock.slice(0,3); track p.id) { <div class="stock-line"><span class="stock-gem">◇</span><span class="stock-copy"><strong>{{p.name}}</strong><small>{{p.sku}}</small></span><span class="stock-count">{{p.available_quantity}} left</span></div> } }
          @else { <p class="aside-empty">Your showcase is well stocked.</p> }
        </section>
        <section class="glass-panel status-panel"><div class="side-heading"><div><span class="section-kicker">WORKSHOP</span><h2>Status summary</h2></div></div>
          <div class="status-line" *ngFor="let row of statusRows()"><span>{{row.status}}</span><i><b [style.width.%]="row.pct"></b></i><strong>{{row.count}}</strong></div>
        </section>
        <section class="glass-panel recent-customers-panel"><div class="side-heading"><div><span class="section-kicker">CLIENTS</span><h2>Recent customers</h2></div><a class="text-link" routerLink="/customers">All <span>↗</span></a></div>
          <a class="recent-customer" *ngFor="let customer of s.recent_customers" [routerLink]="['/customers',customer.id]"><strong>{{customer.name}}</strong><small>{{customer.phone}}</small></a>
          <p class="aside-empty" *ngIf="!s.recent_customers.length">No customers in this month yet.</p>
        </section>
      </aside>
    </div>
  }
</section>
`,providers:[]})
export class DashboardComponent implements OnInit{
  private http=inject(HttpClient);
  private router=inject(Router);
  private toast=inject(ToastService);
  readonly summary=signal<DashboardSummary|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');
  search='';
  month=this.currentMonth();
  readonly customerSuggestions=signal<Customer[]>([]);
  readonly suggestOpen=signal(false);
  private suggestTimer:ReturnType<typeof setTimeout>|undefined;
  private suggestRequest=0;

  readonly statusRows=computed(()=>{
    const s=this.summary();
    if(!s) return [];
    const entries=['OPEN','IN_PROGRESS','PARTIALLY_READY','READY','DELIVERED','CANCELLED'].map(status=>[status,s.orders_by_status[status]||0] as [string,number]);
    const max=Math.max(1,...entries.map(entry=>entry[1]));
    return entries.map(([status,count])=>({status,count,pct:Math.round((count/max)*100)}));
  });
  readonly overTimeMax=computed(()=>{
    const s=this.summary();
    if(!s) return 0;
    return Math.max(0,...s.orders_over_time.map(b=>b.count));
  });

  barHeight(count:number){
    const max=this.overTimeMax();
    return max ? Math.max(12,Math.round(count/max*100)) : 12;
  }

  pieceSymbol(type:string){
    const value=type.toLowerCase();
    if(value.includes('ring')) return '◉';
    if(value.includes('earring')) return '⌁';
    if(value.includes('chain') || value.includes('necklace')) return '〰';
    if(value.includes('bangle') || value.includes('bracelet')) return '◎';
    if(value.includes('pendant')) return '♢';
    return '✧';
  }

  completion(items:import('../../core/models').OrderItem[]){
    if(!items.length) return 0;
    return Math.round(items.filter(i=>['READY','DELIVERED'].includes(i.status)).length/items.length*100);
  }

  orderValue(items:import('../../core/models').OrderItem[]){
    return items.reduce((sum,item)=>sum+(item.estimated_value||0),0);
  }

  nextDelivery(items:import('../../core/models').OrderItem[]){
    const dates=items.filter(i=>i.expected_date && !['DELIVERED','CANCELLED'].includes(i.status)).map(i=>i.expected_date as string).sort();
    return dates.length ? new Date(dates[0]).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'To be confirmed';
  }

  ngOnInit(){this.load();}

  private currentMonth(){
    const now=new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  monthLabel(){
    if(!/^\d{4}-\d{2}$/.test(this.month)) return 'Selected month';
    return new Date(`${this.month}-01T12:00:00`).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  }

  load(){
    this.loading.set(true); this.error.set('');
    this.http.get<DashboardSummary>('/api/dashboard/summary',{params:{month:this.month}}).subscribe({
      next:s=>{this.summary.set(s);this.loading.set(false);},
      error:err=>{this.loading.set(false);this.error.set(this.message(err));}
    });
  }

  suggestCustomers(value:string){
    clearTimeout(this.suggestTimer);
    const term=(value||'').trim();
    const request=++this.suggestRequest;
    if(term.length<2){this.customerSuggestions.set([]);this.suggestOpen.set(false);return;}
    this.suggestTimer=setTimeout(()=>{
      this.http.get<Customer[]>('/api/customers',{params:{q:term,limit:'8'}}).subscribe({
        next:rows=>{
          if(request!==this.suggestRequest) return;
          this.customerSuggestions.set(rows);
          this.suggestOpen.set(rows.length>0);
        },
        error:()=>{if(request===this.suggestRequest){this.customerSuggestions.set([]);this.suggestOpen.set(false);}}
      });
    },180);
  }

  hideSuggestions(){setTimeout(()=>this.suggestOpen.set(false),140);}

  openCustomer(customer:Customer){
    this.suggestOpen.set(false);
    this.customerSuggestions.set([]);
    this.router.navigate(['/customers',customer.id]);
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
