import {Component,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink,RouterLinkActive,RouterOutlet} from '@angular/router';
import {AuthService} from './core/auth.service';
import {ToastService} from './shared/toast.service';

@Component({selector:'app-root',standalone:true,imports:[CommonModule,RouterOutlet,RouterLink,RouterLinkActive],template:`
<div class="shell" [class.authenticated]="auth.isLoggedIn()">
  <aside class="sidebar" *ngIf="auth.isLoggedIn()" [class.open]="navOpen()">
    <a class="brand" routerLink="/" (click)="close()"><span class="brand-mark">AJ</span><span><strong>Anand Jewellers</strong><small>ATELIER · MANAGEMENT</small></span></a>
    <div class="side-label">WORKSPACE</div>
    <nav class="nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" (click)="close()"><span class="nav-icon">⌂</span>Dashboard</a>
      <a routerLink="/orders" routerLinkActive="active" (click)="close()"><span class="nav-icon">▤</span>Orders</a>
      <a routerLink="/products" routerLinkActive="active" (click)="close()"><span class="nav-icon">◇</span>Inventory</a>
      <a routerLink="/customers" routerLinkActive="active" (click)="close()"><span class="nav-icon">♙</span>Customers</a>
      <div class="side-label secondary-label">INSIGHTS</div>
      <a routerLink="/notifications" routerLinkActive="active" (click)="close()"><span class="nav-icon">◉</span>Notifications</a>
      <a routerLink="/reports" routerLinkActive="active" (click)="close()"><span class="nav-icon">▥</span>Reports</a>
      <a routerLink="/settings" routerLinkActive="active" (click)="close()"><span class="nav-icon">⚙</span>Settings</a>
      <a *ngIf="auth.isAdmin()" routerLink="/security" routerLinkActive="active" (click)="close()"><span class="nav-icon">⌑</span>Security</a>
    </nav>
    <div class="sidebar-footer" *ngIf="auth.user() as user"><span class="avatar">AJ</span><span class="profile-copy"><strong>Team member {{user.id}}</strong><small>{{user.role}}</small></span><button type="button" class="logout-icon" aria-label="Log out" (click)="auth.logout()">↗</button></div>
  </aside>
  <div class="main-column">
    <header class="top" *ngIf="auth.isLoggedIn()">
      <button class="nav-toggle" type="button" (click)="navOpen.set(!navOpen())" aria-label="Toggle navigation">☰</button>
      <div class="top-context"><span class="eyebrow">ANAND JEWELLERS · PRIVATE CLIENTS</span><strong>Fine pieces. Thoughtfully made.</strong></div>
      <div class="top-actions"><span class="live-dot"></span><span class="live-label">WORKSHOP LIVE</span><span class="top-divider"></span><span class="today">{{today | date:'EEE, d MMM'}}</span><a class="top-add" routerLink="/orders/new" aria-label="Create order">＋</a></div>
    </header>
    <main class="content"><router-outlet/></main>
  </div>
  <button class="mobile-scrim" *ngIf="navOpen()" (click)="close()" aria-label="Close navigation"></button>
  @if (toast.toasts().length) {
    <div class="toasts">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast {{t.type}}" (click)="toast.dismiss(t.id)">{{t.text}}</div>
      }
    </div>
  }
</div>
`})
export class AppComponent{
  readonly navOpen=signal(false);
  readonly today=new Date();
  constructor(public auth:AuthService,public toast:ToastService){}
  close(){this.navOpen.set(false);}
  logout(event:Event){event.preventDefault();this.close();this.auth.logout();}
}
