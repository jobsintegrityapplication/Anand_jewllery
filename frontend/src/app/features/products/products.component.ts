import {Component,inject,signal,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient,HttpParams} from '@angular/common/http';
import {Product,PRODUCT_CATEGORIES} from '../../core/models';
import {StatusBadgeComponent} from '../../shared/status-badge.component';
import {PaginationComponent} from '../../shared/pagination.component';
import {ToastService} from '../../shared/toast.service';
import {AuthService} from '../../core/auth.service';

interface ProductForm{sku:string;name:string;category:string;description:string;unit_weight_g:number|null;price:number|null;quantity:number;min_quantity:number}

const EMPTY_PRODUCT:ProductForm={sku:'',name:'',category:'GOLD',description:'',unit_weight_g:null,price:null,quantity:0,min_quantity:2};

@Component({selector:'app-products',standalone:true,imports:[CommonModule,FormsModule,StatusBadgeComponent,PaginationComponent],template:`
<div class="page-head">
  <div>
    <h1 class="page-title">Inventory</h1>
    <p class="page-sub">Stock levels, reservations and adjustments</p>
  </div>
  <button class="btn primary" (click)="openAdd()">Add Inventory Item</button>
</div>

<div class="card filter-bar">
  <input class="input grow" placeholder="Search by SKU or name…" [ngModel]="q" (ngModelChange)="onSearch($event)">
  <select class="input" [ngModel]="category" (ngModelChange)="onCategory($event)">
    <option value="">All categories</option>
    @for (c of PRODUCT_CATEGORIES; track c) { <option [value]="c">{{c}}</option> }
  </select>
  <label class="checkbox inline"><input type="checkbox" [ngModel]="lowStock" (ngModelChange)="onLowStock($event)"> Low stock only</label>
</div>

@if (loading()) {
  <div class="card empty"><div class="spinner"></div><p class="muted">Loading inventory…</p></div>
} @else if (error()) {
  <div class="card empty">
    <p class="error">{{error()}}</p>
    <button class="btn primary" (click)="load()">Retry</button>
  </div>
} @else if (!products().length) {
  <div class="card empty">
    <p class="muted">No inventory items found. Add your first item.</p>
    <button class="btn primary" (click)="openAdd()">Add Inventory Item</button>
  </div>
} @else {
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th><th>Reserved</th><th>Available</th><th>Min</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          @for (p of products(); track p.id) {
            <tr>
              <td class="mono">{{p.sku}}</td>
              <td>{{p.name}}</td>
              <td><span class="badge badge-default">{{p.category}}</span></td>
              <td>{{p.quantity}}</td>
              <td>{{p.reserved_quantity}}</td>
              <td><span class="pill" [class.low]="p.available_quantity<=p.min_quantity">{{p.available_quantity}}</span></td>
              <td class="muted">{{p.min_quantity}}</td>
              <td class="muted">{{p.price!=null ? (p.price | number:'1.2-2') : '—'}}</td>
              <td><app-status-badge [status]="p.is_active?'ACTIVE':'INACTIVE'"/></td>
              <td class="actions-cell">
                <button class="btn secondary small" (click)="openEdit(p)">Edit</button>
                <button class="btn secondary small" (click)="openAdjust(p)">Adjust</button>
                <button class="btn secondary small" (click)="openReserve(p)">Reserve</button>
                <button class="btn secondary small" (click)="openRelease(p)">Release</button>
                @if (auth.isAdmin()) { <button class="btn danger small" (click)="remove(p)">Delete</button> }
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
      <h2 class="card-title">{{editing()!.id ? 'Edit Inventory Item' : 'Add Inventory Item'}}</h2>
      <form (ngSubmit)="save()">
        <div class="field"><label>SKU</label><input class="input" name="psku" [(ngModel)]="formState.sku" [disabled]="!!editing()!.id" required></div>
        <div class="field"><label>Name</label><input class="input" name="pname" [(ngModel)]="formState.name" required></div>
        <div class="field">
          <label>Category</label>
          <select class="input" name="pcat" [(ngModel)]="formState.category">
            @for (c of PRODUCT_CATEGORIES; track c) { <option [value]="c">{{c}}</option> }
          </select>
        </div>
        <div class="field"><label>Description</label><textarea class="input" name="pdesc" [(ngModel)]="formState.description" rows="2"></textarea></div>
        <div class="grid form-grid">
          <div class="field"><label>Unit weight (g)</label><input class="input" type="number" min="0" step="0.001" name="pweight" [(ngModel)]="formState.unit_weight_g"></div>
          <div class="field"><label>Price</label><input class="input" type="number" min="0" step="0.01" name="pprice" [(ngModel)]="formState.price"></div>
          @if (!editing()!.id) {
            <div class="field"><label>Quantity</label><input class="input" type="number" min="0" name="pqty" [(ngModel)]="formState.quantity"></div>
          }
          <div class="field"><label>Low-stock threshold</label><input class="input" type="number" min="0" name="pmin" [(ngModel)]="formState.min_quantity"></div>
        </div>
        @if (formError()) { <div class="error">{{formError()}}</div> }
        <div class="row modal-actions">
          <button class="btn secondary" type="button" (click)="closeForm()">Cancel</button>
          <button class="btn primary" type="submit" [disabled]="saving()">Save</button>
        </div>
      </form>
    </div>
  </div>
}

@if (stockModal(); as s) {
  <div class="modal-backdrop" (click)="closeStock()">
    <div class="modal card" (click)="$event.stopPropagation()">
      <h2 class="card-title">{{s.mode}} Stock — {{s.product.sku}}</h2>
      <p class="muted">Current quantity: {{s.product.quantity}} · Reserved: {{s.product.reserved_quantity}} · Available: {{s.product.available_quantity}}</p>
      @if (s.mode==='Adjust') {
        <div class="field">
          <label>Adjustment (+ to add stock, − to remove)</label>
          <input class="input" type="number" name="sdelta" [(ngModel)]="delta">
        </div>
      } @else {
        <div class="field">
          <label>Quantity</label>
          <input class="input" type="number" min="1" name="sqty" [(ngModel)]="delta">
        </div>
      }
      @if (stockError()) { <div class="error">{{stockError()}}</div> }
      <div class="row modal-actions">
        <button class="btn secondary" type="button" (click)="closeStock()">Cancel</button>
        <button class="btn primary" type="button" (click)="applyStock()" [disabled]="applying()">Apply</button>
      </div>
    </div>
  </div>
}
`})
export class ProductsComponent implements OnInit{
  private http=inject(HttpClient);
  private toast=inject(ToastService);
  auth=inject(AuthService);
  readonly PRODUCT_CATEGORIES=PRODUCT_CATEGORIES;

  readonly products=signal<Product[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly editing=signal<(ProductForm&{id:number})|null>(null);
  readonly saving=signal(false);
  readonly formError=signal('');
  readonly stockModal=signal<{mode:'Adjust'|'Reserve'|'Release';product:Product}|null>(null);
  readonly stockError=signal('');
  readonly applying=signal(false);
  readonly total=signal(0);
  readonly page=signal(1);
  pageSize=50;
  q=''; category=''; lowStock=false;
  delta:number|null=null;

  ngOnInit(){this.load();}

  onSearch(value:string){this.q=value;this.page.set(1);this.load();}
  onCategory(value:string){this.category=value||'';this.page.set(1);this.load();}
  onLowStock(value:boolean){this.lowStock=value;this.page.set(1);this.load();}
  goTo(page:number){this.page.set(page);this.load();}

  load(){
    this.loading.set(true); this.error.set('');
    let params=new HttpParams().set('q',this.q).set('skip',(this.page()-1)*this.pageSize).set('limit',this.pageSize);
    if(this.category) params=params.set('category',this.category);
    if(this.lowStock) params=params.set('low_stock','true');
    this.http.get<Product[]>('/api/products',{params,observe:'response'}).subscribe({
      next:res=>{
        this.products.set(res.body||[]);
        const total=res.headers.get('X-Total-Count');
        this.total.set(total?Number(total):(res.body||[]).length);
        this.loading.set(false);
      },
      error:err=>{this.loading.set(false);this.error.set(this.message(err,'Could not load inventory.'));}
    });
  }

  openAdd(){this.editing.set({...EMPTY_PRODUCT,id:0});this.formError.set('');}

  openEdit(p:Product){
    this.editing.set({id:p.id,sku:p.sku,name:p.name,category:p.category,description:p.description||'',unit_weight_g:p.unit_weight_g!=null?Number(p.unit_weight_g):null,price:p.price!=null?Number(p.price):null,quantity:p.quantity,min_quantity:p.min_quantity});
    this.formError.set('');
  }

  closeForm(){this.editing.set(null);}

  save(){
    const form=this.editing();
    if(!form||this.saving()) return;
    if(!form.sku.trim()||!form.name.trim()){this.formError.set('SKU and name are required.');return;}
    this.saving.set(true); this.formError.set('');
    const payload:any={
      name:form.name.trim(),
      category:form.category,
      description:form.description.trim()||null,
      unit_weight_g:form.unit_weight_g,
      price:form.price,
      min_quantity:form.min_quantity,
    };
    const request=form.id
      ?this.http.patch<Product>(`/api/products/${form.id}`,payload)
      :this.http.post<Product>('/api/products',{...payload,sku:form.sku.trim(),quantity:form.quantity});
    request.subscribe({
      next:()=>{
        this.saving.set(false);
        this.toast.success(form.id?'Inventory item updated.':'Inventory item added.');
        this.closeForm();
        this.load();
      },
      error:err=>{this.saving.set(false);this.formError.set(this.message(err,'Could not save the inventory item.'));}
    });
  }

  openAdjust(p:Product){this.delta=null;this.stockError.set('');this.stockModal.set({mode:'Adjust',product:p});}
  openReserve(p:Product){this.delta=null;this.stockError.set('');this.stockModal.set({mode:'Reserve',product:p});}
  openRelease(p:Product){this.delta=null;this.stockError.set('');this.stockModal.set({mode:'Release',product:p});}
  closeStock(){this.stockModal.set(null);}

  applyStock(){
    const modal=this.stockModal();
    if(!modal||this.applying()) return;
    if(this.delta===null||isNaN(this.delta)||modal.mode!=='Adjust'&&this.delta<1){
      this.stockError.set('Enter a valid quantity.');
      return;
    }
    this.applying.set(true); this.stockError.set('');
    const id=modal.product.id;
    const request=modal.mode==='Adjust'
      ?this.http.post<Product>(`/api/products/${id}/adjust`,{delta:this.delta})
      :this.http.post<Product>(`/api/products/${id}/${modal.mode.toLowerCase()}`,{quantity:this.delta});
    request.subscribe({
      next:()=>{
        this.applying.set(false);
        this.toast.success(`Stock ${modal.mode.toLowerCase()} applied.`);
        this.closeStock();
        this.load();
      },
      error:err=>{this.applying.set(false);this.stockError.set(this.message(err,'Could not apply the stock change.'));}
    });
  }

  remove(p:Product){
    if(!confirm(`Deactivate inventory item "${p.sku}"? Its stock will be zeroed.`)) return;
    this.http.delete(`/api/products/${p.id}`).subscribe({
      next:()=>{this.toast.success('Inventory item deactivated.');this.load();},
      error:err=>{this.toast.error(this.message(err,'Could not delete the item. Admin role required.'));}
    });
  }

  private message(err:unknown,fallback:string):string{
    const detail=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof detail==='string'?detail:fallback;
  }
}
