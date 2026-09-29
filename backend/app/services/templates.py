from string import Template
from app.core.config import settings

DEFAULT_TEMPLATES={
    'ORDER_CREATED':'Dear {{customer_name}}, your order {{order_number}} has been received by Anand Jewellers. Thank you for choosing us.',
    'ORDER_IN_PROGRESS':'Dear {{customer_name}}, your Anand Jewellers order {{order_number}} is now in progress. We will notify you when it is ready.',
    'ORDER_READY':'Dear {{customer_name}}, your Anand Jewellers order {{order_number}} is ready for collection. Please contact us if you need any assistance.',
    'ORDER_DELIVERED':'Thank you {{customer_name}} for choosing Anand Jewellers. Order {{order_number}} has been marked as delivered.',
    'CUSTOM':'{{message}}',
}

def configured_template(notification_type:str)->str:
    overrides={
        'ORDER_CREATED':settings.WHATSAPP_TEMPLATE_ORDER_CREATED,
        'ORDER_IN_PROGRESS':settings.WHATSAPP_TEMPLATE_ORDER_IN_PROGRESS,
        'ORDER_READY':settings.WHATSAPP_TEMPLATE_ORDER_READY,
        'ORDER_DELIVERED':settings.WHATSAPP_TEMPLATE_ORDER_DELIVERED,
    }
    return overrides.get(notification_type) or DEFAULT_TEMPLATES.get(notification_type) or DEFAULT_TEMPLATES['CUSTOM']

def render_template(template:str,context:dict)->str:
    # {{var}} placeholders are converted to ${var}; safe_substitute leaves
    # unknown placeholders untouched instead of raising.
    return Template(template.replace('{{','${').replace('}}','}')).safe_substitute(context)
