import httpx
from app.core.config import settings

async def send_template(phone:str,template_name:str,params:list[str]):
    if not settings.WHATSAPP_ENABLED: return {'status':'DISABLED'}
    url=f'https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages'
    payload={'messaging_product':'whatsapp','to':phone,'type':'template','template':{'name':template_name,'language':{'code':settings.WHATSAPP_TEMPLATE_LANGUAGE},'components':[{'type':'body','parameters':[{'type':'text','text':p} for p in params]}]}}
    headers={'Authorization':f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}','Content-Type':'application/json'}
    async with httpx.AsyncClient(timeout=20) as client:
        r=await client.post(url,json=payload,headers=headers); r.raise_for_status(); data=r.json()
    return {'status':'SENT','message_id':data.get('messages',[{}])[0].get('id')}

async def send_text(phone:str,message:str):
    # Dev/mock provider: when WhatsApp is not configured nothing is sent and the
    # notification is marked SENT so local development does not fail.
    if not settings.WHATSAPP_ENABLED: return {'status':'SENT','message_id':None,'mock':True}
    url=f'https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages'
    payload={'messaging_product':'whatsapp','to':phone,'type':'text','text':{'body':message}}
    headers={'Authorization':f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}','Content-Type':'application/json'}
    async with httpx.AsyncClient(timeout=20) as client:
        r=await client.post(url,json=payload,headers=headers); r.raise_for_status(); data=r.json()
    return {'status':'SENT','message_id':data.get('messages',[{}])[0].get('id')}

async def send_item_ready(phone:str, customer_name:str, order_number:str):
    # Kept for backward compatibility with the ready-template flow.
    return await send_template(phone,settings.WHATSAPP_READY_TEMPLATE_NAME,[customer_name,order_number])
