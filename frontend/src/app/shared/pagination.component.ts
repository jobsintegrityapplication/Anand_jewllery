import {Component,computed,input,output} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({selector:'app-pagination',standalone:true,imports:[CommonModule],template:`
<div class="pagination" *ngIf="pages() > 1">
  <button class="btn secondary small" [disabled]="page()<=1" (click)="go(page()-1)">Prev</button>
  <span class="muted">Page {{page()}} of {{pages()}}</span>
  <button class="btn secondary small" [disabled]="page()>=pages()" (click)="go(page()+1)">Next</button>
</div>
`})
export class PaginationComponent{
  readonly page=input.required<number>();
  readonly size=input.required<number>();
  readonly total=input.required<number>();
  readonly pageChange=output<number>();

  readonly pages=computed(()=>Math.max(1,Math.ceil(this.total()/Math.max(1,this.size()))));

  go(page:number){this.pageChange.emit(page);}
}
