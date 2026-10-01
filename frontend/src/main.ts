import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter,Routes} from '@angular/router';
import {provideHttpClient,withInterceptors} from '@angular/common/http';
import {AppComponent} from './app/app.component';
import {authInterceptor} from './app/core/auth.interceptor';
import {LoginComponent} from './app/features/login/login.component';
import {DashboardComponent} from './app/features/dashboard/dashboard.component';
import {CustomersComponent} from './app/features/customers/customers.component';
import {CustomerDetailComponent} from './app/features/customers/customer-detail.component';
import {OrdersComponent} from './app/features/orders/orders.component';
import {OrderCreateComponent} from './app/features/orders/order-create.component';
import {OrderDetailComponent} from './app/features/orders/order-detail.component';
import {ProductsComponent} from './app/features/products/products.component';
import {NotificationsComponent} from './app/features/notifications/notifications.component';
import {ReportsComponent} from './app/features/reports/reports.component';
import {SettingsComponent} from './app/features/settings/settings.component';
import {SecurityComponent} from './app/features/settings/security.component';
import {adminGuard,authGuard} from './app/core/auth.guard';

const routes:Routes=[
  {path:'login',component:LoginComponent},
  {path:'',canActivate:[authGuard],component:DashboardComponent},
  {path:'customers',canActivate:[authGuard],component:CustomersComponent},
  {path:'customers/:id',canActivate:[authGuard],component:CustomerDetailComponent},
  {path:'orders',canActivate:[authGuard],component:OrdersComponent},
  {path:'orders/new',canActivate:[authGuard],component:OrderCreateComponent},
  {path:'orders/:id',canActivate:[authGuard],component:OrderDetailComponent},
  {path:'products',canActivate:[authGuard],component:ProductsComponent},
  {path:'notifications',canActivate:[authGuard],component:NotificationsComponent},
  {path:'reports',canActivate:[authGuard],component:ReportsComponent},
  {path:'settings',canActivate:[authGuard],component:SettingsComponent},
  {path:'security',canActivate:[adminGuard],component:SecurityComponent},
  {path:'**',redirectTo:''},
];

bootstrapApplication(AppComponent,{providers:[provideRouter(routes),provideHttpClient(withInterceptors([authInterceptor]))]}).catch(console.error);
