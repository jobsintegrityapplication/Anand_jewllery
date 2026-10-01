import {Component,inject,signal,computed,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {Customer,Product,Order,ITEM_TYPES} from '../../core/models';
import {ToastService} from '../../shared/toast.service';
import {forkJoin} from 'rxjs';

interface ItemDraft{
  item_type:string;description:string;design:string;quantity:number;count:number;expected_date:string;
  estimated_value:number|null;gold_rate:number|null;gold_purity:string;net_weight_g:number|null;
  making_charges:number|null;wastage_percent:number|null;other_charges:number|null;
  workshop_notes:string;product_id:number|null;designImage:File|null;
}

const EMPTY_ITEM:ItemDraft={item_type:'Ring',description:'',design:'',quantity:1,count:1,expected_date:'',estimated_value:null,gold_rate:null,gold_purity:'22K',net_weight_g:null,making_charges:null,wastage_percent:null,other_charges:null,workshop_notes:'',product_id:null,designImage:null};

@Component({selector:'app-order-create',standalone:true,imports:[CommonModule,FormsModule,RouterLink],template:`
<a class="link back-link" routerLink="/orders">← Back to Orders</a>
<div class="page-head">
  <div>
    <h1 class="page-title">Create Order</h1>
    <p class="page-sub">Add a customer, then add one or more jewellery items</p>
  </div>
</div>

<div class="card">
  <h2 class="card-title">Customer</h2>
  <div class="row mode-row">
    <label class="radio"><input type="radio" name="cmode" value="existing" [(ngModel)]="customerMode"> Existing customer</label>
    <label class="radio"><input type="radio" name="cmode" value="new" [(ngModel)]="customerMode"> New customer</label>
  </div>

  @if (customerMode==='existing') {
    <div class="row">
      <input class="input grow" placeholder="Filter customers by name or phone…" [(ngModel)]="customerFilter">
      <select class="input grow" [(ngModel)]="selectedCustomerId">
        <option [ngValue]="null">Select a customer…</option>
        @for (c of filteredCustomers(); track c.id) {
          <option [ngValue]="c.id">{{c.name}} — {{c.phone}} @if (c.whatsapp_opt_in) { ✓ WhatsApp }</option>
        }
      </select>
      <button class="btn secondary small" (click)="loadCustomers()">Refresh</button>
    </div>
  } @else {
    <div class="grid form-grid">
      <div class="field"><label>Name</label><input class="input" name="nname" [(ngModel)]="newCustomer.name" required></div>
      <div class="field"><label>Mobile number</label><input class="input" name="nphone" [(ngModel)]="newCustomer.phone" placeholder="+9198…" required></div>
      <div class="field"><label>Email</label><input class="input" name="nemail" [(ngModel)]="newCustomer.email" type="email"></div>
      <div class="field checkbox"><label><input type="checkbox" name="noptin" [(ngModel)]="newCustomer.whatsapp_opt_in"> WhatsApp opt-in</label></div>
      <div class="field span-2"><label>Address</label><textarea class="input" name="naddress" [(ngModel)]="newCustomer.address" rows="2"></textarea></div>
    </div>
  }
</div>

<div class="card">
  <div class="card-head">
    <h2 class="card-title">Order Details</h2>
  </div>
  <div class="grid form-grid">
    <div class="field">
      <label>Expected completion date</label>
      <input class="input" type="date" name="oexpected" [(ngModel)]="expectedDate">
    </div>
    <div class="field">
      <label>Order notes</label>
      <input class="input" name="onotes" [(ngModel)]="orderNotes" placeholder="Occasion, special instructions…">
    </div>
  </div>
</div>

<div class="card">
  <div class="card-head">
    <h2 class="card-title">Jewellery Items</h2>
    <button class="btn primary small" type="button" (click)="addItem()">Add Item</button>
  </div>
  @if (!items().length) {
    <p class="muted">No items added yet. Use “Add Item” to add jewellery items to this order.</p>
  }
  @for (item of items(); track $index) {
    <div class="item-editor">
      <div class="item-editor-head">
        <strong>Item {{$index+1}}</strong>
        <button class="btn danger small" type="button" (click)="removeItem($index)">Remove</button>
      </div>
      <div class="grid form-grid">
        <div class="field">
          <label>Item type</label>
          <select class="input" name="itype-{{$index}}" [(ngModel)]="item.item_type">
            @for (t of ITEM_TYPES; track t) { <option [value]="t">{{t}}</option> }
          </select>
        </div>
        <div class="field">
          <label>Quantity</label>
          <input class="input" type="number" min="1" step="1" name="iqty-{{$index}}" [(ngModel)]="item.quantity" required>
        </div>
        <div class="field"><label>Count</label><input class="input" type="number" min="1" step="1" name="icount-{{$index}}" [(ngModel)]="item.count" required></div>
        <div class="field">
          <label>Expected completion date</label>
          <input class="input" type="date" name="iexp-{{$index}}" [(ngModel)]="item.expected_date">
        </div>
        <div class="field"><label>Gold purity</label><input class="input" name="ipurity-{{$index}}" [(ngModel)]="item.gold_purity" placeholder="22K"></div>
        <div class="field span-2">
          <label>Design</label>
          <input class="input" name="idesign-{{$index}}" [(ngModel)]="item.design" placeholder="Design name or reference…">
        </div>
        <div class="field"><label>Net weight (g)</label><input class="input" type="number" min="0" step="0.001" name="iweight-{{$index}}" [(ngModel)]="item.net_weight_g"></div>
        <div class="field"><label>Gold rate (₹ / g)</label><input class="input" type="number" min="0" step="0.01" name="irate-{{$index}}" [(ngModel)]="item.gold_rate"></div>
        <div class="field"><label>Making charges (₹)</label><input class="input" type="number" min="0" step="0.01" name="imaking-{{$index}}" [(ngModel)]="item.making_charges"></div>
        <div class="field"><label>Wastage (%)</label><input class="input" type="number" min="0" max="100" step="0.001" name="iwastage-{{$index}}" [(ngModel)]="item.wastage_percent"></div>
        <div class="field"><label>Stone / other charges (₹)</label><input class="input" type="number" min="0" step="0.01" name="iother-{{$index}}" [(ngModel)]="item.other_charges"></div>
        <div class="field"><label>Total estimated value (₹)</label><input class="input" type="number" min="0" step="0.01" name="ival-{{$index}}" [(ngModel)]="item.estimated_value"></div>
        <div class="field span-2 estimate-note">Gold base reference: {{(item.net_weight_g||0) * (item.gold_rate||0) | currency:'INR':'symbol':'1.2-2'}} <span>Net weight × entered gold rate. Final estimate remains staff-entered; no pricing formula is assumed.</span></div>
        <div class="field span-2"><label>Design / reference image</label><input class="input" type="file" accept="image/*" (change)="selectPhoto(item,$event)"><small class="muted" *ngIf="item.designImage">{{item.designImage.name}}</small></div>
        <div class="field span-2"><label>Design notes / dimensions</label><textarea class="input" name="idesc-{{$index}}" [(ngModel)]="item.description" rows="2" placeholder="Size, engraving, design detail…"></textarea></div>
        <div class="field span-2">
          <label>Link inventory product (optional)</label>
          <select class="input" name="iprod-{{$index}}" [(ngModel)]="item.product_id">
            <option [ngValue]="null">No inventory link</option>
            @for (p of products(); track p.id) {
              <option [ngValue]="p.id">{{p.sku}} — {{p.name}} ({{p.available_quantity}} available)</option>
            }
          </select>
        </div>
        <div class="field span-2">
          <label>Item notes</label>
          <input class="input" name="inotes-{{$index}}" [(ngModel)]="item.workshop_notes" placeholder="Workshop instructions…">
        </div>
      </div>
    </div>
  }
</div>

@if (error()) { <div class="card error-card"><div class="error">{{error()}}</div></div> }

<div class="row save-row">
  <button class="btn secondary" routerLink="/orders">Cancel</button>
  <button class="btn primary save-btn" (click)="save()" [disabled]="saving()">
    {{saving() ? 'Saving…' : 'Save Order'}}
  </button>
</div>
`})
export class OrderCreateComponent implements OnInit{
  private http=inject(HttpClient);
  private route=inject(ActivatedRoute);
  private router=inject(Router);
  private toast=inject(ToastService);
  readonly ITEM_TYPES=ITEM_TYPES;

  customerMode:'existing'|'new'='existing';
  customerFilter='';
  selectedCustomerId:number|null=null;
  newCustomer={name:'',phone:'',email:'',address:'',whatsapp_opt_in:false};
  expectedDate=''; orderNotes='';
  readonly items=signal<ItemDraft[]>([]);
  readonly customers=signal<Customer[]>([]);
  readonly products=signal<Product[]>([]);
  readonly saving=signal(false);
  readonly error=signal('');

  readonly filteredCustomers=computed(()=>{
    const q=this.customerFilter.trim().toLowerCase();
    const list=this.customers();
    if(!q) return list;
    return list.filter(c=>c.name.toLowerCase().includes(q)||c.phone.includes(q));
  });

  ngOnInit(){
    this.loadCustomers();
    this.loadProducts();
    this.route.queryParamMap.subscribe(params=>{
      const cid=params.get('customer_id');
      if(cid){this.customerMode='existing';this.selectedCustomerId=Number(cid);}
    });
  }

  loadCustomers(){
    this.http.get<Customer[]>('/api/customers',{params:{limit:'200'}}).subscribe({
      next:list=>{
        this.customers.set(list);
        if(this.selectedCustomerId&&!list.some(c=>c.id===this.selectedCustomerId)) this.selectedCustomerId=null;
      },
      error:()=>this.toast.error('Could not load customers.')
    });
  }

  loadProducts(){
    this.http.get<Product[]>('/api/products',{params:{limit:'200'}}).subscribe({
      next:list=>this.products.set(list),
      error:()=>this.toast.error('Could not load inventory products.')
    });
  }

  addItem(){this.items.update(list=>[...list,{...EMPTY_ITEM}]);}

  selectPhoto(item:ItemDraft,event:Event){item.designImage=(event.target as HTMLInputElement).files?.[0]||null;}

  private finishCreate(order:Order){this.saving.set(false);this.toast.success(`Order ${order.order_number} created.`);this.router.navigate(['/orders',order.id]);}

  removeItem(index:number){this.items.update(list=>list.filter((_,i)=>i!==index));}

  save(){
    if(this.saving()) return;
    let customerId=this.selectedCustomerId;
    if(this.customerMode==='new'){
      if(!this.newCustomer.name.trim()||!this.newCustomer.phone.trim()){
        this.error.set('Enter the new customer\'s name and mobile number, or switch to an existing customer.');
        return;
      }
    } else if(!customerId){
      this.error.set('Select a customer for this order.');
      return;
    }
    const invalid=this.items().find(i=>!i.item_type||i.quantity<1||i.count<1||(i.net_weight_g!=null&&i.net_weight_g<0)||(i.gold_rate!=null&&i.gold_rate<0));
    if(invalid){this.error.set('Each item needs a type, positive quantity and count, and non-negative gold values.');return;}
    this.saving.set(true); this.error.set('');

    const createOrder=(customerId:number)=>{
      const payload={
        customer_id:customerId,
        expected_delivery_date:this.expectedDate||null,
        notes:this.orderNotes.trim()||null,
        items:this.items().map(i=>({
          item_type:i.item_type,
          description:i.description.trim()||null,
          design:i.design.trim()||null,
          quantity:i.quantity,
          count:i.count,
          expected_date:i.expected_date||null,
          estimated_value:i.estimated_value,
          gold_rate:i.gold_rate,
          gold_purity:i.gold_purity.trim()||null,
          net_weight_g:i.net_weight_g,
          making_charges:i.making_charges,
          wastage_percent:i.wastage_percent,
          other_charges:i.other_charges,
          workshop_notes:i.workshop_notes.trim()||null,
          product_id:i.product_id,
        })),
      };
      this.http.post<Order>('/api/orders',payload).subscribe({
        next:o=>{
          const uploads=o.items.flatMap((created,index)=>{
            const file=this.items()[index]?.designImage;
            if(!file) return [];
            const form=new FormData();form.append('file',file);
            return [this.http.post(`/api/orders/items/${created.id}/photo`,form)];
          });
          if(!uploads.length){this.finishCreate(o);return;}
          forkJoin(uploads).subscribe({
            next:()=>this.finishCreate(o),
            error:()=>{this.saving.set(false);this.toast.error('Order saved, but one or more design images did not upload.');this.router.navigate(['/orders',o.id]);}
          });
        },
        error:err=>{
          this.saving.set(false);
          this.error.set(this.detail(err,'Could not create the order.'));
        }
      });
    };

    if(this.customerMode==='new'){
      this.http.post<Customer>('/api/customers',{
        name:this.newCustomer.name.trim(),
        phone:this.newCustomer.phone.trim(),
        email:this.newCustomer.email.trim()||null,
        address:this.newCustomer.address.trim()||null,
        whatsapp_opt_in:this.newCustomer.whatsapp_opt_in,
      }).subscribe({
        next:c=>createOrder(c.id),
        error:err=>{
          this.saving.set(false);
          this.error.set(this.detail(err,'Could not create the new customer.'));
        }
      });
    } else if(customerId){
      createOrder(customerId);
    }
  }

  private detail(err:unknown,fallback:string):string{
    const d=(err as {error?:{detail?:string}})?.error?.detail;
    return typeof d==='string'?d:fallback;
  }
}
