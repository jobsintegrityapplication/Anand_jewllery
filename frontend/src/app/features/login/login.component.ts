import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from '../../core/auth.service';

@Component({selector:'app-login',standalone:true,imports:[CommonModule,FormsModule],template:`
<div class="login-wrap">
  <div class="card login-card">
    <div class="login-brand"><span class="brand-mark">AJ</span></div>
    <h1 class="login-title">Anand Jewellers</h1>
    <p class="muted login-sub">Customer interaction & workshop tracking</p>
    <form (ngSubmit)="submit()">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" class="input" name="username" [(ngModel)]="username" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" class="input" type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required>
      </div>
      @if (error()) {
        <div class="error login-error">{{error()}}</div>
      }
      <button class="btn primary login-btn" type="submit" [disabled]="loading()">
        {{loading() ? 'Signing in…' : 'Sign in'}}
      </button>
    </form>
  </div>
</div>
`})
export class LoginComponent{
  private auth=inject(AuthService);
  private router=inject(Router);
  username=''; password='';
  readonly loading=signal(false);
  readonly error=signal('');

  submit(){
    if(this.loading()) return;
    if(!this.username.trim()||!this.password){this.error.set('Enter your username and password.');return;}
    this.loading.set(true); this.error.set('');
    this.auth.login(this.username.trim(),this.password).subscribe({
      next:res=>{this.auth.store(res.access_token);this.loading.set(false);this.router.navigate(['/']);},
      error:err=>{
        this.loading.set(false);
        this.error.set(err?.error?.detail||'Login failed. Check your username and password.');
      }
    });
  }
}
