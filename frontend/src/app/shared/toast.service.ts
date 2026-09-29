import {Injectable,signal} from '@angular/core';

export interface Toast{id:number;type:'success'|'error';text:string}

@Injectable({providedIn:'root'})
export class ToastService{
  private seq=0;
  readonly toasts=signal<Toast[]>([]);

  success(text:string){this.show('success',text);}
  error(text:string){this.show('error',text,6000);}

  private show(type:'success'|'error',text:string,duration=3500){
    const id=++this.seq;
    this.toasts.update(list=>[...list,{id,type,text}]);
    setTimeout(()=>this.toasts.update(list=>list.filter(t=>t.id!==id)),duration);
  }

  dismiss(id:number){this.toasts.update(list=>list.filter(t=>t.id!==id));}
}
