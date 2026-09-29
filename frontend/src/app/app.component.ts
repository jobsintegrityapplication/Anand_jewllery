import {Component,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink,RouterLinkActive,RouterOutlet} from '@angular/router';
import {AuthService} from './core/auth.service';
import {ToastService} from './shared/toast.service';

@Component({selector:'app-root',standalone:true,imports:[CommonModule,RouterOutlet,RouterLink,RouterLinkActive],template:`
<div class="shell">
  <header class="top">
    <div class="brand"><span class="brand-mark">AJ</span> Anand Jewellers</div>
    <button class="nav-toggle" type="button" (click)="navOpen.set(!navOpen())" aria-label="Toggle navigation">&#9776;</button>
    <nav class="nav" [class.open]="navOpen()" *ngIf="auth.isLoggedIn()">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" (click)="close()">Dashboard</a>
      <a routerLink="/customers" routerLinkActive="active" (click)="close()">Customers</a>
      <a routerLink="/orders" routerLinkActive="active" (click)="close()">Orders</a>
      <a routerLink="/products" routerLinkActive="active" (click)="close()">Inventory</a>
      <a routerLink="/notifications" routerLinkActive="active" (click)="close()">Notifications</a>
      <a routerLink="/reports" routerLinkActive="active" (click)="close()">Reports</a>
      <a routerLink="/settings" routerLinkActive="active" (click)="close()">Settings</a>
      <a href="#" class="logout" (click)="logout($event)">Logout</a>
    </nav>
  </header>
  <main class="content">
    <router-outlet/>
  </main>
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
  constructor(public auth:AuthService,public toast:ToastService){}
  close(){this.navOpen.set(false);}
  logout(event:Event){event.preventDefault();this.close();this.auth.logout();}
}
