import re,os
import boto3
from botocore.client import Config
from app.core.config import settings
s3=boto3.client('s3',endpoint_url=settings.S3_ENDPOINT_URL,aws_access_key_id=settings.S3_ACCESS_KEY,aws_secret_access_key=settings.S3_SECRET_KEY,region_name=settings.S3_REGION,config=Config(signature_version='s3v4'))
def safe_filename(name:str|None)->str:
    # Strip any path components and unsafe characters to prevent path traversal.
    base=os.path.basename(name or 'upload')
    cleaned=re.sub(r'[^A-Za-z0-9._-]','_',base).strip('._')
    return cleaned[:120] or 'upload'
def ensure_bucket():
    try: s3.head_bucket(Bucket=settings.S3_BUCKET)
    except Exception:
        s3.create_bucket(Bucket=settings.S3_BUCKET)
def upload(key,fileobj,content_type):
    ensure_bucket(); s3.upload_fileobj(fileobj,settings.S3_BUCKET,key,ExtraArgs={'ContentType':content_type,'ServerSideEncryption':'AES256'}); return key
def presigned(key,expires=900):
    if not key:return None
    return s3.generate_presigned_url('get_object',Params={'Bucket':settings.S3_BUCKET,'Key':key},ExpiresIn=expires)
