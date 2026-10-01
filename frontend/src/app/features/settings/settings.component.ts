import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {AppUser,AppSettings,AuditEntry} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {ToastService} from '../../shared/toast.service';
import {AuthService} from '../../core/auth.service';

@Component({selector:'app-settings',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,RouterLink],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Settings</h1>
    <p class="page-sub">Account, users and integration status</p>
  </div>
</div>

<div class="grid dash-grid">
  <div class="card">
    <h2 class="card-title">Account</h2>
    @if (profile(); as u) {
      <div class="info-list">
        <div class="info-row"><span>User</span><span>{{u.username}}</span></div>
        <div class="info-row"><span>Role</span><span class="badge {{u.role==='ADMIN'?'badge-sent':'badge-default'}}">{{u.role}}</span></div>
      </div>
    }
    <p class="muted">Roles: ADMIN has full access. STAFF can manage customers, orders, item tracking and notifications with limited inventory access.</p>
    <button class="btn secondary" (click)="auth.logout()">Logout</button>
  </div>

  <div class="card">
    <h2 class="card-title">Integration Status</h2>
    @if (appSettings(); as s) {
      <ul class="list">
        <li class="list-row">
          <span>WhatsApp Cloud API</span>
          @if (s.whatsapp_configured) { <span class="badge badge-sent">Configured</span> }
          @else if (s.whatsapp_enabled) { <span class="badge badge-failed">Missing credentials</span> }
          @else { <span class="badge badge-hold">Disabled (dev provider)</span> }
        </li>
        <li class="list-row">
          <span>Photo storage (S3/MinIO)</span>
          @if (s.s3_configured) { <span class="badge badge-sent">Configured</span> } @else { <span class="badge badge-hold">Not configured</span> }
        </li>
        <li class="list-row"><span>Public URL</span><span class="muted">{{s.app_public_url}}</span></li>
      </ul>
    } @else { <p class="muted">Loading…</p> }
    <p class="muted">Configure these values in the server’s <code>.env</code> file. Secrets are never stored in the browser or this codebase.</p>
  </div>
</div>

<div class="card" *ngIf="auth.isAdmin()">
  <div class="card-head"><h2 class="card-title">Recent audit</h2><a class="link" routerLink="/security">Security access</a></div>
  @if (auditLoading()) { <p class="muted">Loading audit history…</p> }
  @else if (auditError()) { <p class="error">{{auditError()}}</p> }
  @else if (!recentAudit().length) { <p class="muted">No audit events have been recorded yet.</p> }
  @else {
    <div class="recent-audit-list">
      @for (entry of recentAudit(); track entry.id) {
        <div class="recent-audit-row"><strong>{{entry.event_type}} · {{entry.entity}} {{entry.entity_id ? '#'+entry.entity_id : ''}}</strong><span>{{auditActor(entry)}} · {{entry.created_at | date:'short'}}</span></div>
      }
    </div>
  }
</div>

<div class="card">
  <div class="card-head">
    <h2 class="card-title">User Management</h2>
  </div>
  @if (!auth.isAdmin()) {
    <p class="muted">User management is available to ADMIN users only.</p>
  } @else {
    <form class="row user-form" (ngSubmit)="createUser()">
      <input class="input" placeholder="Username" name="uusername" [(ngModel)]="newUser.username" required>
      <input class="input" type="password" placeholder="Password" name="upassword" [(ngModel)]="newUser.password" required>
      <select class="input" name="urole" [(ngModel)]="newUser.role">
        <option value="STAFF">STAFF</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <button class="btn primary" type="submit" [disabled]="savingUser()">Add User</button>
    </form>
    @if (userError()) { <div class="error">{{userError()}}</div> }
    @if (usersLoading()) {
      <div class="empty"><div class="spinner"></div><p class="muted">Loading users…</p></div>
    } @else if (!users().length) {
      <p class="muted">No users found.</p>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>{{u.username}}</td>
                <td><span class="badge {{u.role==='ADMIN'?'badge-sent':'badge-default'}}">{{u.role}}</span></td>
                <td><app-status-badge [status]="u.is_active?'ACTIVE':'INACTIVE'"/></td>
                <td class="muted">{{u.created_at | date:'mediumDate'}}</td>
                <td class="actions-cell">
                  <button class="btn secondary small" (click)="resetPassword(u)">Reset password</button>
                  @if (u.id!==auth.user()?.id) {
                    @if (u.is_active) {
                      <button class="btn danger small" (click)="setActive(u,false)">Deactivate</button>
                    } @else {
                      <button class="btn primary small" (click)="setActive(u,true)">Activate</button>
                    }
                  } @else { <span class="muted small-label">You</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  }
</div>

<div class="card">
  <h2 class="card-title">API Reference</h2>
  <p class="muted">The backend exposes an OpenAPI schema at <a class="link" href="/api/docs" target="_blank" rel="noopener">/api/docs</a>.</p>
  <ul class="list">
    <li class="list-row"><span>Authentication</span><span class="muted mono">POST /api/auth/login</span></li>
    <li class="list-row"><span>Customers</span><span class="muted mono">GET/POST/PATCH/DELETE /api/customers</span></li>
    <li class="list-row"><span>Orders & items</span><span class="muted mono">GET/POST/PATCH/DELETE /api/orders</span></li>
    <li class="list-row"><span>Inventory</span><span class="muted mono">GET/POST/PATCH/DELETE /api/products</span></li>
    <li class="list-row"><span>Notifications</span><span class="muted mono">GET/POST /api/notifications</span></li>
    <li class="list-row"><span>Reports</span><span class="muted mono">GET /api/reports/summary</span></li>
    <li class="list-row"><span>Audit trail</span><span class="muted mono">GET /api/audit (admin)</span></li>
    <li class="list-row"><span>Users</span><span class="muted mono">GET/POST/PATCH /api/users (admin)</span></li>
  </ul>
</div>
`})
export class SettingsComponent implements OnInit{
  private http=inject(HttpClient);
  private toast=inject(ToastService);
  auth=inject(AuthService);

  readonly users=signal<AppUser[]>([]);
  readonly appSettings=signal<AppSettings|null>(null);
  readonly usersLoading=signal(false);
  readonly savingUser=signal(false);
  readonly userError=signal('');
  readonly recentAudit=signal<AuditEntry[]>([]);
  readonly auditLoading=signal(false);
  readonly auditError=signal('');
  readonly profile=signal<{id:number;username:string;role:string}|null>(null);
  newUser={username:'',password:'',role:'STAFF'};

  ngOnInit(){
    if(this.auth.isAdmin()) this.loadUsers();
    if(this.auth.isAdmin()) this.loadAudit();
    this.http.get<{id:number;username:string;role:string}>('/api/auth/me').subscribe({next:user=>this.profile.set(user)});
    this.http.get<AppSettings>('/api/settings').subscribe({
      next:s=>this.appSettings.set(s),
      error:()=>this.appSettings.set(null)
    });
  }

  loadAudit(){
    this.auditLoading.set(true);
    this.http.get<AuditEntry[]>('/api/audit',{params:{limit:'5'}}).subscribe({
      next:rows=>{this.recentAudit.set(rows);this.auditLoading.set(false);},
      error:()=>{this.auditError.set('Could not load recent audit events.');this.auditLoading.set(false);}
    });
  }

  auditActor(entry:AuditEntry){
    if(entry.meta?.['username']) return String(entry.meta['username']);
    return entry.user_id===null?'system':`user #${entry.user_id}`;
  }

  loadUsers(){
    this.usersLoading.set(true);
    this.http.get<AppUser[]>('/api/users').subscribe({
      next:u=>{this.users.set(u);this.usersLoading.set(false);},
      error:()=>{this.users.set([]);this.usersLoading.set(false);}
    });
  }

  createUser(){
    if(this.savingUser()) return;
    if(!this.newUser.username.trim()||!this.newUser.password){
      this.userError.set('Enter a username and password.');
      return;
    }
    if(this.newUser.password.length<8){
      this.userError.set('Password must be at least 8 characters.');
      return;
    }
    this.savingUser.set(true); this.userError.set('');
    this.http.post<AppUser>('/api/users',{username:this.newUser.username.trim(),password:this.newUser.password,role:this.newUser.role}).subscribe({
      next:()=>{
        this.savingUser.set(false);
        this.toast.success('User created.');
        this.newUser={username:'',password:'',role:'STAFF'};
        this.loadUsers();
      },
      error:err=>{
        this.savingUser.set(false);
        const detail=(err as {error?:{detail?:string}})?.error?.detail;
        this.userError.set(typeof detail==='string'?detail:'Could not create the user.');
      }
    });
  }

  resetPassword(u:AppUser){
    const password=prompt(`New password for ${u.username} (min 8 characters):`);
    if(!password) return;
    if(password.length<8){this.toast.error('Password must be at least 8 characters.');return;}
    this.http.patch<AppUser>(`/api/users/${u.id}`,{password}).subscribe({
      next:()=>this.toast.success('Password updated.'),
      error:()=>this.toast.error('Could not update the password.')
    });
  }

  setActive(u:AppUser,active:boolean){
    this.http.patch<AppUser>(`/api/users/${u.id}`,{is_active:active}).subscribe({
      next:()=>{this.toast.success(active?'User activated.':'User deactivated.');this.loadUsers();},
      error:err=>{
        const detail=(err as {error?:{detail?:string}})?.error?.detail;
        this.toast.error(typeof detail==='string'?detail:'Could not update the user.');
      }
    });
  }
}
