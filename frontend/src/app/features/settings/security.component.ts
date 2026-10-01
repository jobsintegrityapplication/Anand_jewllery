import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {AuditEntry} from '../../core/models';

@Component({
  selector:'app-security',
  standalone:true,
  imports:[CommonModule],
  template:`
    <div class="page-head">
      <div><h1 class="page-title">Security access</h1><p class="page-sub">Sign-ins and customer phone changes recorded by the application</p></div>
      <button class="btn secondary" type="button" (click)="load()">Refresh</button>
    </div>
    @if (loading()) {
      <div class="card empty"><div class="spinner"></div><p class="muted">Loading security history…</p></div>
    } @else if (error()) {
      <div class="card empty"><p class="error">{{error()}}</p><button class="btn primary" type="button" (click)="load()">Retry</button></div>
    } @else {
      <section class="card security-card">
        <h2 class="card-title">Sign-in history</h2>
        @if (!signIns().length) { <p class="empty muted">No successful sign-ins have been recorded yet.</p> }
        @else {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>When</th><th>Username</th><th>Role</th><th>Browser</th><th>Address</th></tr></thead>
            <tbody>@for (entry of signIns(); track entry.id) {
              <tr><td>{{entry.created_at | date:'short'}}</td><td>{{value(entry,'username')}}</td><td>{{value(entry,'role')}}</td><td>{{value(entry,'browser')}}</td><td>{{value(entry,'ip')}}</td></tr>
            }</tbody>
          </table></div>
        }
      </section>
      <section class="card security-card">
        <h2 class="card-title">Edited customer phone numbers</h2>
        @if (!phoneChanges().length) { <p class="empty muted">No phone corrections have been recorded.</p> }
        @else {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>When</th><th>Customer</th><th>Changed by</th><th>Previous number</th><th>Updated number</th></tr></thead>
            <tbody>@for (entry of phoneChanges(); track entry.id) {
              <tr><td>{{entry.created_at | date:'short'}}</td><td>{{value(entry,'customer')}}</td><td>{{value(entry,'username')}} · {{value(entry,'role')}}</td><td>{{value(entry,'previous_phone')}}</td><td>{{value(entry,'phone')}}</td></tr>
            }</tbody>
          </table></div>
        }
      </section>
    }
  `
})
export class SecurityComponent {
  private http=inject(HttpClient);
  readonly entries=signal<AuditEntry[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly signIns=()=>this.entries().filter(entry=>entry.event_type==='access');
  readonly phoneChanges=()=>this.entries().filter(entry=>entry.event_type==='phone_corrected');

  constructor(){this.load();}

  value(entry:AuditEntry,key:string):string {
    const value=entry.meta?.[key];
    if(value!==undefined&&value!==null&&String(value).length) return String(value);
    return key==='ip'?'—':'Unknown';
  }

  load(){
    this.loading.set(true);
    this.error.set('');
    this.http.get<AuditEntry[]>('/api/audit',{params:{limit:'500'}}).subscribe({
      next:rows=>{this.entries.set(rows);this.loading.set(false);},
      error:err=>{
        const detail=(err as {error?:{detail?:string}})?.error?.detail;
        this.error.set(typeof detail==='string'?detail:'Could not load security history.');
        this.loading.set(false);
      }
    });
  }
}
