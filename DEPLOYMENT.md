# Hosting on AWS — recommended first production deployment

## Option A: simplest

Use one Ubuntu 24.04 EC2/Lightsail VM for the Docker stack and S3 for images. If the client needs stronger database reliability, use Amazon RDS PostgreSQL instead of the bundled Postgres container.

### Suggested starting size

- 2 vCPU
- 4 GB RAM minimum; 8 GB is more comfortable if all services stay on one VM
- 40–80 GB SSD for application/temporary data
- S3 for jewellery images

## Steps

1. Create VM.
2. Point `app.anandjewellers.com` to its public IP using an A record.
3. Install Docker and Compose.
4. Clone repository.
5. `cp .env.example .env` and replace every `CHANGE_ME` value.
6. For production, set `CORS_ORIGINS=https://app.anandjewellers.com` and `APP_PUBLIC_URL=https://app.anandjewellers.com`.
7. Use a private S3 bucket and a dedicated IAM user with only required bucket permissions.
8. Start: `docker compose up -d --build`.
9. Verify: `https://app.anandjewellers.com/api/health`.
10. Add TLS. Easiest: Cloudflare proxy + origin certificate, or install Certbot on the VM and terminate TLS in Nginx.
11. Change admin password immediately.
12. Configure backups.

## WhatsApp production setup

1. Create/verify Meta Business account.
2. Create WhatsApp Business Platform app.
3. Add phone number.
4. Obtain phone-number ID and access token.
5. Create and get approval for the `item_ready` template.
6. Put credentials in `.env`.
7. Set `WHATSAPP_ENABLED=true`.
8. Test with an opted-in customer.

## Important production hardening

- Do not expose Postgres, Redis or MinIO ports publicly.
- Use HTTPS only.
- Store secrets in AWS Secrets Manager/SSM for mature deployments.
- Use RDS Multi-AZ if uptime becomes critical.
- Enable S3 versioning and lifecycle rules.
- Test database restore monthly.
- Add audit logs before production handover.
- Add WhatsApp webhook handling for delivery/read/failure states.
- Add rate limits and login lockout before public exposure.
