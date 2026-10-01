# Anand Jewellers — Customer Interaction & Workshop Tracking System

Production-oriented baseline for the Anand Jewellers application:

- Angular PWA frontend
- FastAPI backend
- PostgreSQL
- S3/MinIO object storage for jewellery photos
- Redis + Celery for asynchronous notifications
- JWT authentication + role-based access
- Month-filtered business dashboard and administrator security access history
- QR code generation
- WhatsApp Cloud API integration
- Docker Compose for local/staging/production deployment
- Nginx reverse proxy

> This repository is a deployable baseline, not a claim that every business-specific edge case has been validated. Before production, configure secrets, WhatsApp business verification/templates, domain/HTTPS, backups, monitoring, retention policies and UAT.

## 1. Local setup

Requirements: Docker + Docker Compose.

```bash
cp .env.example .env
# edit secrets in .env

docker compose up -d --build
```

Open `http://localhost`.

Default seeded users (change immediately):
- username: `admin`, password: `ChangeMe_123!` (ADMIN)
- username: `staff`, password: `Staff_123!` (STAFF)

Demo data (fictional customers, orders, items, notifications and inventory) is seeded on first start when the database is empty.

For frontend development outside Docker (`npm start`), create `frontend/proxy.conf.json` with `{"/api": {"target": "http://localhost:8000", "secure": false, "changeOrigin": true}}` so `/api` calls reach a locally running backend.

## 2. Production deployment

Recommended first deployment: one Ubuntu 24.04 LTS VM (2–4 vCPU, 4–8 GB RAM) with Docker Compose, a managed PostgreSQL database if budget permits, S3 for photos, and a domain pointed to the VM.

1. Provision VM and open ports 22, 80, 443.
2. Install Docker Engine + Compose plugin.
3. Clone this repository.
4. Copy `.env.example` to `.env` and set strong values.
5. Set `APP_PUBLIC_URL=https://your-domain.com`.
6. Configure S3 bucket and credentials.
7. Configure Meta WhatsApp Cloud API credentials and an approved template.
8. Start stack: `docker compose up -d --build`.
9. Put TLS in front of Nginx (Cloudflare Tunnel/Origin certificate or Certbot).
10. Configure daily PostgreSQL backups and object-storage lifecycle/versioning.

For a first client demo, the included Docker Compose deployment is enough. For higher scale, move PostgreSQL and Redis to managed services and use an object-storage CDN.

## 3. API

Health: `GET /api/health`
Docs: `/api/docs`

Auth:
- `POST /api/auth/login`

Customers:
- `GET /api/customers` (q, skip, limit; returns `X-Total-Count`)
- `POST /api/customers`
- `GET /api/customers/{id}`
- `GET /api/customers/{id}/summary` (order/item statistics)
- `PATCH /api/customers/{id}`
- `DELETE /api/customers/{id}` (blocked if customer has orders)

Products/Inventory:
- `GET /api/products` (q, category, low_stock, skip, limit; returns `X-Total-Count`)
- `POST /api/products`
- `GET /api/products/{id}`
- `PATCH /api/products/{id}`
- `POST /api/products/{id}/adjust` (delta)
- `POST /api/products/{id}/reserve` (quantity)
- `POST /api/products/{id}/release` (quantity)
- `DELETE /api/products/{id}` (soft delete, ADMIN role required)

Orders:
- `GET /api/orders` (q, status, customer_id, created_from/to, expected_from/to, sort, skip, limit; returns `X-Total-Count`)
- `POST /api/orders` (optional `items` array; reserves stock in one transaction)
- `GET /api/orders/{id}`
- `GET /api/orders/{id}/timeline` (audit-based status history)
- `PATCH /api/orders/{id}` (status transitions validated)
- `DELETE /api/orders/{id}` (releases reservations)
- `POST /api/orders/{id}/items` (optional product_id + quantity; reserves stock)
- `PATCH /api/orders/items/{item_id}`
- `DELETE /api/orders/items/{item_id}` (releases reservation)
- `PATCH /api/orders/items/{item_id}/status` (validated transitions; DELIVERED consumes reserved stock, CANCELLED releases it)
- `GET /api/orders/items/{item_id}/qr`
- `POST /api/orders/items/{item_id}/notify-ready` (idempotent, respects opt-in)

Photos:
- `POST /api/orders/items/{item_id}/photo`
- `GET /api/orders/items/{item_id}/photo-url`

Notifications:
- `GET /api/notifications` (status, type, customer_id, order_id, created_from/to filters)
- `GET /api/notifications/{id}`
- `POST /api/notifications` (custom message for a customer; respects opt-in)
- `POST /api/notifications/{id}/retry` (idempotent)

Dashboard/Reporting:
- `GET /api/dashboard/summary` (counts, status breakdowns, orders over time, low stock, recent orders/customers, notification stats)
- `GET /api/reports/summary` (period=today|7d|30d|month|custom, orders by status/date, customer growth, repeat customers, notification results)

Audit/Users:
- `GET /api/audit` (entity, entity_id, event_type, order_id filters; ADMIN only)
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/{id}` (ADMIN only)
- `GET /api/settings` (non-sensitive integration status)

Inventory model: `available = quantity - reserved`. Creating an order item with a linked product reserves stock; marking it DELIVERED consumes the reserved stock; CANCELLED or deleting the item releases it. All stock changes run in database transactions with row locks on PostgreSQL.

## 4. WhatsApp

Set:
- `WHATSAPP_ENABLED=true`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_READY_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE`

The template should accept the customer name and order number as parameters. The service deliberately does not send anything until enabled.

## 5. Production checklist

- Replace seeded admin password.
- Use a long random `JWT_SECRET_KEY`.
- Restrict CORS to the real frontend origin.
- Enable HTTPS.
- Use a managed Postgres or encrypted backups.
- Enable S3 bucket encryption and private access.
- Configure WhatsApp opt-in and template approval.
- Add Meta webhook handling before relying on delivery/read status.
- Set retention rules required by the client (audit logging is built in: `GET /api/audit`).
- Run the backend test suite: `docker compose run --rm backend pytest`. 
- Configure monitoring/alerts.
- Perform UAT with real workflows before handover.
