from pydantic import BaseModel,Field,computed_field
from datetime import date,datetime
from decimal import Decimal
from typing import Literal
from .common import ORMModel
from .customer import CustomerOut
class OrderCreate(BaseModel): customer_id:int; expected_delivery_date:date|None=None; notes:str|None=None; items:list['ItemCreate']=[]
class OrderUpdate(BaseModel): expected_delivery_date:date|None=None; notes:str|None=None; status:str|None=None
class ItemCreate(BaseModel):
    item_type:str=Field(min_length=2,max_length=80); description:str|None=None; design:str|None=None; product_id:int|None=None
    quantity:int=Field(default=1,ge=1); count:int=Field(default=1,ge=1); expected_date:date|None=None
    estimated_value:float|None=Field(default=None,ge=0); gold_rate:float|None=Field(default=None,ge=0)
    gold_purity:str|None=Field(default=None,max_length=24); net_weight_g:float|None=Field(default=None,ge=0)
    making_charges:float|None=Field(default=None,ge=0); wastage_percent:float|None=Field(default=None,ge=0,le=100)
    other_charges:float|None=Field(default=None,ge=0); workshop_notes:str|None=None
class ItemStatusUpdate(BaseModel): status:str; workshop_notes:str|None=None; cancellation_reason:str|None=None
class PaymentCreate(BaseModel):
    amount:Decimal=Field(gt=0,max_digits=12,decimal_places=2)
    method:Literal['CASH','UPI','CARD','BANK_TRANSFER','CHEQUE','OTHER']
    reference:str|None=Field(default=None,max_length=120)
    note:str|None=None
class PaymentOut(ORMModel):
    id:int;order_id:int;amount:float;method:str;reference:str|None;note:str|None;received_by:int|None;paid_at:datetime
class ItemOut(ORMModel):
    id:int; item_code:str; item_type:str; description:str|None; design:str|None; quantity:int; count:int; status:str
    expected_date:date|None; estimated_value:float|None; gold_rate:float|None; gold_purity:str|None; net_weight_g:float|None
    making_charges:float|None; wastage_percent:float|None; other_charges:float|None; cancellation_reason:str|None
    ready_at:datetime|None; photo_key:str|None; product_id:int|None; workshop_notes:str|None; created_at:datetime
class OrderOut(ORMModel):
    id:int; order_number:str; customer_id:int; customer:CustomerOut|None=None; expected_delivery_date:date|None; notes:str|None
    status:str; created_at:datetime; updated_at:datetime; items:list[ItemOut]=[];payments:list[PaymentOut]=[]
    invoice_number:str|None=None;invoice_issued_at:datetime|None=None
    @computed_field
    @property
    def total_estimated_value(self)->float:
        return sum(float(item.estimated_value or 0) for item in self.items)
    @computed_field
    @property
    def amount_paid(self)->float:
        return sum(float(payment.amount or 0) for payment in self.payments)
    @computed_field
    @property
    def balance_due(self)->float:
        return max(0.0,self.total_estimated_value-self.amount_paid)
    @computed_field
    @property
    def payment_status(self)->str:
        if self.total_estimated_value<=0:return 'NOT_ESTIMATED'
        if self.amount_paid<=0:return 'UNPAID'
        return 'PAID' if self.amount_paid>=self.total_estimated_value else 'PARTIAL'
OrderCreate.model_rebuild()
