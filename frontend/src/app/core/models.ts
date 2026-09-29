export interface Customer{
  id:number;name:string;phone:string;email:string|null;address:string|null;
  whatsapp_opt_in:boolean;notes:string|null;created_at:string;updated_at:string;
}

export interface OrderItem{
  id:number;item_code:string;item_type:string;description:string|null;quantity:number;
  status:string;expected_date:string|null;estimated_value:number|null;ready_at:string|null;
  photo_key:string|null;product_id:number|null;workshop_notes:string|null;created_at:string;
}

export interface Order{
  id:number;order_number:string;customer_id:number;customer:Customer|null;
  expected_delivery_date:string|null;notes:string|null;status:string;
  created_at:string;updated_at:string;items:OrderItem[];
}

export interface Product{
  id:number;sku:string;name:string;category:string;description:string|null;
  unit_weight_g:number|null;price:number|null;quantity:number;reserved_quantity:number;
  available_quantity:number;min_quantity:number;is_active:boolean;created_at:string;
}

export interface Notification{
  id:number;customer_id:number;order_id:number|null;order_item_id:number|null;
  channel:string;type:string|null;message:string|null;status:string;
  provider_message_id:string|null;error:string|null;retry_count:number;
  created_at:string;sent_at:string|null;customer?:Customer|null;order_number?:string|null;
}

export interface AuditEntry{
  id:number;event_type:string;entity:string;entity_id:number|null;order_id:number|null;
  user_id:number|null;meta:Record<string,unknown>|null;created_at:string;
}

export interface AppUser{id:number;username:string;role:string;is_active:boolean;created_at:string}

export interface DashboardSummary{
  customers_total:number;orders_total:number;
  orders_open:number;orders_in_progress:number;orders_partially_ready:number;
  orders_ready:number;orders_delivered:number;orders_cancelled:number;
  items_pending:number;items_ready:number;items_delivered:number;
  items_by_status:Record<string,number>;orders_by_status:Record<string,number>;
  orders_over_time:{date:string;count:number}[];
  low_stock:{id:number;sku:string;name:string;quantity:number;reserved_quantity:number;available_quantity:number;min_quantity:number}[];
  notifications_queued:number;notifications_sent:number;notifications_failed:number;
  recent_orders:Order[];
  recent_customers:{id:number;name:string;phone:string;whatsapp_opt_in:boolean}[];
}

export interface CustomerSummary{
  orders_total:number;orders_open:number;orders_in_progress:number;orders_ready:number;
  orders_delivered:number;items_total:number;items_pending:number;items_ready:number;items_delivered:number;
}

export interface ReportSummary{
  period:string;from:string;to:string;orders_total:number;
  orders_by_status:Record<string,number>;orders_ready:number;orders_pending:number;orders_delivered:number;
  orders_by_date:{date:string;count:number}[];
  customers_new:number;customer_growth:{date:string;count:number}[];
  repeat_customers:number;items_by_status:Record<string,number>;
  notifications_by_status:Record<string,number>;notifications_success:number;notifications_failed:number;
}

export interface AppSettings{
  whatsapp_enabled:boolean;whatsapp_configured:boolean;s3_configured:boolean;app_public_url:string;
}

export const ITEM_TYPES=['Ring','Chain','Bangle','Earring','Pendant','Necklace','Bracelet','Dollar','Diamond Ring','Other'];
export const PRODUCT_CATEGORIES=['GOLD','DIAMOND','SILVER','PLATINUM','OTHER'];
export const ORDER_STATUSES=['OPEN','IN_PROGRESS','PARTIALLY_READY','READY','DELIVERED','CANCELLED'];
export const ITEM_STATUSES=['ORDER_CREATED','SENT_TO_WORKSHOP','IN_PROGRESS','QUALITY_CHECK','REWORK_REQUIRED','READY','DELIVERED','ON_HOLD','CANCELLED'];
