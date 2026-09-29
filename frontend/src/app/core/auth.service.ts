import {Injectable,signal,computed} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';

export const TOKEN_KEY='anj_token';

export interface AuthUser{id:number;role:string}

@Injectable({providedIn:'root'})
export class AuthService{
  private userSignal=signal<AuthUser|null>(this.readUser());
  readonly user=computed(()=>this.userSignal());

  constructor(private http:HttpClient,private router:Router){}

  private readUser():AuthUser|null{
    const token=localStorage.getItem(TOKEN_KEY);
    if(!token) return null;
    try{
      const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if(payload.exp&&payload.exp*1000<Date.now()){localStorage.removeItem(TOKEN_KEY);return null;}
      return {id:Number(payload.sub),role:String(payload.role||'STAFF')};
    }catch{
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  }

  isLoggedIn(){return this.userSignal()!==null;}
  isAdmin(){return this.userSignal()?.role==='ADMIN';}

  login(username:string,password:string){
    return this.http.post<{access_token:string;token_type:string}>('/api/auth/login',{username,password});
  }

  store(token:string){localStorage.setItem(TOKEN_KEY,token);this.userSignal.set(this.readUser());}

  logout(){localStorage.removeItem(TOKEN_KEY);this.userSignal.set(null);this.router.navigate(['/login']);}
}
