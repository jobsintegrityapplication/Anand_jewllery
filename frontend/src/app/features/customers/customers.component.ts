import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient,HttpParams} from '@angular/common/http';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Customer} from '../../core/models';
import {PaginationComponent} from '../../shared/pagination.component';
import {ToastService} from '../../shared/toast.service';

interface CustomerForm{name:string;phone:string;email:string;address:string;whatsapp_opt_in:boolean;notes:string}

const EMPTY_FORM:CustomerForm={name:'',phone:'',email:'',address:'',whatsapp_opt_in:false,notes:''};

@Component({selector:'app-customers',standalone:true,imports:[CommonModule,FormsModule,PaginationComponent,RouterLink],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Customers</h1>
    <p class="page-sub">Search, add and manage customer profiles</p>
  </div>
  <button class="btn primary" (click)="openAdd()">Add Customer</button>
</div>

<div class="card filter-bar">
  <input class="input" aria-label="Search customers by name or mobile number" placeholder="Search by name or mobile number…" [ngModel]="q" (ngModelChange)="onSearch($event)">
</div>

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading customers…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (!customers().length) {
  <div class="card empty">
    <p class="muted">No customers yet. Add your first customer.</p>
    <button class="btn primary" (click)="openAdd()">Add Customer</button>
  </div>
} @else {
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Orders</th><th>Latest status</th><th>WhatsApp</th><th>Actions</th></tr></thead>
        <tbody>
          @for (c of customers(); track c.id) {
            <tr>
              <td><a class="link" [routerLink]="['/customers',c.id]">{{c.name}}</a></td>
              <td><a class="link" [href]="'tel:'+c.phone">{{c.phone}}</a></td>
              <td class="muted">{{c.email||'—'}}</td>
              <td>{{c.order_count||0}}</td>
              <td>@if (c.latest_order_status) { <span class="badge badge-default">{{c.latest_order_status}}</span> } @else { <span class="muted">No orders</span> }</td>
              <td>@if (c.whatsapp_opt_in) { <span class="badge badge-sent">Opted in</span> } @else { <span class="badge badge-hold">No</span> }</td>
              <td class="actions-cell">
                <a class="btn secondary small" [routerLink]="['/customers',c.id]">View</a>
                <button class="btn secondary small" (click)="openEdit(c)">Edit</button>
                <button class="btn danger small" (click)="remove(c)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <app-pagination [page]="page()" [size]="pageSize" [total]="total()" (pageChange)="goTo($event)"/>
  </div>
}

@if (editing(); as formState) {
  <div class="modal-backdrop" (click)="closeForm()">
    <div class="modal card" (click)="$event.stopPropagation()">
      <h2 class="card-title">{{editing()!.id ? 'Edit Customer' : 'Add Customer'}}</h2>
      <form (ngSubmit)="save()">
        <div class="field">
          <label>Name</label>
          <input class="input" name="cname" [(ngModel)]="formState.name" required>
        </div>
        <div class="field">
          <label>Mobile number</label>
          <input class="input" name="cphone" [(ngModel)]="formState.phone" placeholder="+91 98765 43210" pattern="^\\+?[0-9][0-9\\s\\-]{5,18}$" minlength="8" maxlength="20" required>
        </div>
        <div class="field">
          <label>Email</label>
          <input class="input" name="cemail" [(ngModel)]="formState.email" type="email">
        </div>
        <div class="field">
          <label>Address</label>
          <textarea class="input" name="caddress" [(ngModel)]="formState.address" rows="2"></textarea>
        </div>
        <div class="field checkbox">
          <label><input type="checkbox" name="coptin" [(ngModel)]="formState.whatsapp_opt_in"> WhatsApp opt-in</label>
        </div>
        <div class="field">
          <label>Notes</label>
          <textarea class="input" name="cnotes" [(ngModel)]="formState.notes" rows="2"></textarea>
        </div>
        @if (formError()) { <div class="error">{{formError()}}</div> }
        <div class="row modal-actions">
          <button class="btn secondary" type="button" (click)="closeForm()">Cancel</button>
          <button class="btn primary" type="submit" [disabled]="saving()">{{saving() ? 'Saving…' : 'Save'}}</button>
        </div>
      </form>
    </div>
  </div>
}
`})
export class CustomersComponent implements OnInit{
  private http=inject(HttpClient);
  private route=inject(ActivatedRoute);
  private router=inject(Router);
  private toast=inject(ToastService);

  readonly customers=signal<Customer[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly editing=signal<(CustomerForm&{id:number})|null>(null);
  readonly saving=signal(false);
  readonly formError=signal('');
  readonly total=signal(0);
  readonly page=signal(1);
  pageSize=50;
  q='';

  ngOnInit(){
    this.route.queryParamMap.subscribe(params=>{
      this.q=params.get('q')||'';
      this.page.set(1);
      this.load();
      if(params.get('new')==='1') this.openAdd();
    });
  }

  onSearch(value:string){this.q=value;this.page.set(1);this.load();}

  goTo(page:number){this.page.set(page);this.load();}

  load(){
    this.loading.set(true); this.error.set('');
    const params=new HttpParams().set('q',this.q).set('skip',(this.page()-1)*this.pageSize).set('limit',this.pageSize);
    this.http.get<Customer[]>('/api/customers',{params,observe:'response'}).subscribe({
      next:res=>{
        this.customers.set(res.body||[]);
        const total=res.headers.get('X-Total-Count');
        this.total.set(total?Number(total):(res.body||[]).length);
        this.loading.set(false);
      },
      error:err=>{this.loading.set(false);this.error.set(this.message(err,'Could not load customers.'));}
    });
  }

  openAdd(){
    this.editing.set({...EMPTY_FORM,id:0});
    this.formError.set('');
  }

  openEdit(c:Customer){
    this.editing.set({id:c.id,name:c.name,phone:c.phone,email:c.email||'',address:c.address||'',whatsapp_opt_in:c.whatsapp_opt_in,notes:c.notes||''});
    this.formError.set('');
  }

  closeForm(){this.editing.set(null);}

  save(){
    const form=this.editing();
    if(!form||this.saving()) return;
    if(!form.name.trim()||!form.phone.trim()){this.formError.set('Name and mobile number are required.');return;}
    this.saving.set(true); this.formError.set('');
    const payload={name:form.name.trim(),phone:form.phone.trim(),email:form.email.trim()||null,address:form.address.trim()||null,whatsapp_opt_in:form.whatsapp_opt_in,notes:form.notes.trim()||null};
    const request=form.id
      ?this.http.patch<Customer>(`/api/customers/${form.id}`,payload)
      :this.http.post<Customer>('/api/customers',payload);
    request.subscribe({
      next:()=>{
        this.saving.set(false);
        this.toast.success(form.id?'Customer updated.':'Customer added.');
        this.closeForm();
        this.load();
      },
      error:err=>{
        this.saving.set(false);
        this.formError.set(this.message(err,'Could not save the customer.'));
      }
    });
  }

  remove(c:Customer){
    if(!confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    this.http.delete(`/api/customers/${c.id}`).subscribe({
      next:()=>{this.toast.success('Customer deleted.');this.load();},
      error:err=>{this.toast.error(this.message(err,'Could not delete the customer.'));}
    });
  }

  private message(err:unknown,fallback:string):string{
    const detail=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof detail==='string'?detail:fallback;
  }
}
