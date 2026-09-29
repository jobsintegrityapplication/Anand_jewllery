import {Component,computed,input} from '@angular/core';

const STATUS_CLASSES:Record<string,string>={
  'OPEN':'badge-open',
  'IN_PROGRESS':'badge-progress',
  'PARTIALLY_READY':'badge-partial',
  'READY':'badge-ready',
  'DELIVERED':'badge-delivered',
  'CANCELLED':'badge-cancelled',
  'ORDER_CREATED':'badge-open',
  'SENT_TO_WORKSHOP':'badge-workshop',
  'QUALITY_CHECK':'badge-quality',
  'REWORK_REQUIRED':'badge-rework',
  'ON_HOLD':'badge-hold',
  'QUEUED':'badge-queued',
  'SENT':'badge-sent',
  'FAILED':'badge-failed',
  'ACTIVE':'badge-sent',
  'INACTIVE':'badge-hold',
};

@Component({selector:'app-status-badge',standalone:true,template:`<span class="badge {{cls()}}">{{status()}}</span>`})
export class StatusBadgeComponent{
  readonly status=input.required<string>();
  readonly cls=computed(()=>STATUS_CLASSES[this.status()]??'badge-default');
}
