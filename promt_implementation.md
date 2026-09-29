# Anand Jewellers — GLM/NVIDIA End-to-End Implementation Prompt Pack

## How to use this file

Open the existing project in Cursor/VS Code and use your GLM/NVIDIA coding agent.

Project root:

`C:\Users\ZMIT\Downloads\anand-jewellers-production-starter\anand-jewellers`

The agent must process the prompts **one at a time, in order**.

Important operating rule for every prompt:

1. First inspect the existing repository and understand the current implementation.
2. Do NOT rewrite the application from scratch.
3. Reuse existing architecture, APIs, database models, Docker setup, authentication, and UI components wherever possible.
4. Before changing code, identify the files that need modification.
5. Implement the requested feature completely across frontend + backend + database + background worker when applicable.
6. Preserve all currently working functionality.
7. Run appropriate tests/build/lint checks after implementation.
8. If Docker is used, verify the affected containers start correctly.
9. Do not stop at creating mock UI. Connect the UI to real backend APIs and persistent database data.
10. Do not invent API endpoints when an existing endpoint can be reused.
11. Do not remove existing functionality just to make the new feature easier.
12. Keep the code production-quality and maintainable.
13. When a requirement is ambiguous, inspect the existing code first and make the smallest reasonable assumption.
14. At the end of each prompt, report:
   - files changed
   - database changes
   - API changes
   - frontend changes
   - tests/builds executed
   - any remaining issue

Do not ask me to manually paste large amounts of code. Make the changes directly in the repository.

---

# PROMPT 00 — Full Repository Audit

Read and understand the entire existing Anand Jewellers application before changing anything.

Inspect:

- backend/
- frontend/
- infra/
- docker-compose.yml
- .env.example
- README.md
- DEPLOYMENT.md
- database models
- migrations
- API routes
- authentication
- Celery/Redis worker
- WhatsApp notification implementation
- MinIO integration
- Nginx configuration
- frontend routing
- frontend services
- frontend components
- existing CSS/design system

Create an internal implementation map of the application.

Determine:

- current frontend framework and version
- current backend framework and version
- database schema
- authentication flow
- customer model
- order model
- order item model
- order status lifecycle
- WhatsApp integration
- background jobs
- file/image storage
- current dashboard calculations
- existing API endpoints
- current Docker architecture
- current seed data
- known gaps preventing a complete jewellery customer/order tracking system

Do not make destructive changes.

After understanding the repository, implement only small safe fixes if you identify an obvious broken configuration that prevents the application from running.

---

# PROMPT 01 — Establish a Stable Baseline

Before adding major features, make the current application stable.

Run:

- backend tests if available
- frontend build
- Docker Compose build
- Docker Compose startup
- API health checks
- frontend loading check

Verify:

- login works
- dashboard loads
- customers page loads
- orders page loads
- customer API works
- orders API works
- PostgreSQL works
- Redis works
- Celery worker starts
- Nginx routes frontend/API correctly

Fix only issues that are actually found.

Do not redesign the application yet.

---

# PROMPT 02 — Professional Anand Jewellers UI Shell

Upgrade the current UI into a professional jewellery-business management application while preserving all functionality.

Use the existing frontend technology.

Design requirements:

- premium jewellery-business appearance
- clean white/off-white background
- dark navy navigation/header
- subtle gold accent
- professional typography
- generous spacing
- responsive desktop/tablet/mobile layout
- cards with subtle borders/shadows
- accessible buttons
- clear status badges
- consistent tables
- consistent forms
- loading states
- empty states
- error states
- success notifications

Navigation should include:

- Dashboard
- Customers
- Orders
- Inventory
- Notifications
- Reports
- Settings
- Logout

Do not use fake navigation pages. If a page does not yet exist, create the route and a proper placeholder stating its current implementation status.

Keep the current login/authentication mechanism.

---

# PROMPT 03 — Dashboard

Build a complete business dashboard.

Dashboard should show:

1. Total Customers
2. Total Orders
3. Open Orders
4. Ready Orders
5. Delivered Orders
6. Pending Items
7. Ready Items
8. WhatsApp notifications pending/failed if available

Add:

- Recent Orders table
- Recent Customers
- Order status distribution
- Orders created over time
- Items pending/ready summary
- quick actions

Quick actions:

- Add Customer
- Create Order
- Search Customer
- View Orders

All values must come from real backend APIs/database.

Do not hard-code dashboard numbers.

Add refresh/loading/error handling.

---

# PROMPT 04 — Customer Management

Build a complete customer-management module.

Customer fields should support at least:

- customer ID
- name
- mobile number
- alternate phone if appropriate
- WhatsApp opt-in
- email if supported
- address if supported
- notes
- created date
- updated date

Features:

- add customer
- edit customer
- view customer
- search customer
- search by phone
- search by name
- customer detail page
- order history
- WhatsApp opt-in management
- validation
- duplicate phone protection where appropriate

The current customer list should become a professional searchable table.

Add:

- pagination if required
- empty state
- loading state
- error state
- confirmation for destructive actions

---

# PROMPT 05 — Customer Detail Page

Create a complete customer profile.

Show:

- customer information
- WhatsApp consent status
- total orders
- open orders
- ready orders
- completed orders
- total items
- recent orders
- order history

Actions:

- Edit customer
- Create order
- Send WhatsApp notification where allowed
- View order

Clicking an order should open its complete order detail.

---

# PROMPT 06 — Order Creation

Improve order creation into a proper jewellery workflow.

Order creation must allow:

- selecting an existing customer
- creating a new customer without losing the order workflow
- adding one or multiple jewellery items
- item type
- item description
- quantity
- expected completion date
- notes
- optional estimated value
- optional image/file attachment if the existing storage architecture supports it

Suggested item types:

- Ring
- Chain
- Bangle
- Earring
- Pendant
- Necklace
- Bracelet
- Dollar
- Diamond Ring
- Other

Use a dynamic item list rather than only a single "first item type" field.

Allow:

- Add item
- Remove item
- Edit item
- Save order

Generate a unique order number using the existing application convention.

Persist everything in PostgreSQL.

---

# PROMPT 07 — Order Detail Page

Create a complete order detail page.

Show:

- order number
- customer
- customer phone
- WhatsApp consent
- created date
- expected completion date
- order status
- items
- item status
- notes
- attachments/images if available
- notification history

Provide actions appropriate to the current status.

Order lifecycle should support at least:

OPEN
IN_PROGRESS
READY
DELIVERED
CANCELLED

Do not allow invalid status transitions.

Show a visual order-status timeline.

---

# PROMPT 08 — Jewellery Item Tracking

Implement item-level tracking.

A single order can contain multiple items.

Each item should support:

- item ID
- item type
- description
- quantity
- status
- expected date
- ready date
- notes
- optional image
- optional estimated value

Item statuses:

- PENDING
- IN_PROGRESS
- READY
- DELIVERED
- CANCELLED

Order status should be derived intelligently from item statuses where appropriate.

Example:

- all items READY -> order READY
- any item IN_PROGRESS -> order IN_PROGRESS
- all items DELIVERED -> order DELIVERED
- no completed work -> OPEN

Do not break existing order data.

---

# PROMPT 09 — Orders Management UI

Replace the current basic Orders page with a professional order-management interface.

Features:

- search by order number
- search by customer
- search by phone
- filter by order status
- filter by date
- filter by expected completion date
- sort
- pagination
- view order
- update status
- WhatsApp action
- customer link

Table columns:

- Order
- Customer
- Phone
- Items
- Status
- Expected Date
- Created Date
- Actions

Use responsive behavior for smaller screens.

---

# PROMPT 10 — Order Status Workflow

Implement safe status transitions.

Provide a clear status-update UI.

For each transition:

- validate current state
- validate target state
- persist change
- record timestamp
- record who performed the action if the current auth model supports users
- create an audit entry if practical
- trigger notification when configured

Do not send duplicate WhatsApp messages automatically.

Use background jobs for external notifications.

---

# PROMPT 11 — WhatsApp Notification Architecture

Inspect the existing WhatsApp/Celery implementation.

Do not replace a working integration unnecessarily.

Build a notification abstraction that supports:

- order created
- order in progress
- order ready
- order delivered
- custom customer message

Respect WhatsApp opt-in.

Notification record should track:

- customer
- order
- notification type
- message
- status
- provider message ID if available
- created time
- sent time
- failure reason
- retry count

Statuses:

QUEUED
SENT
FAILED

Use Celery/Redis for asynchronous sending.

If the external WhatsApp provider is not configured, implement a safe mock/dev provider behind configuration so local development does not fail.

---

# PROMPT 12 — WhatsApp Message Templates

Create configurable message templates.

Example templates:

ORDER_CREATED:
"Dear {{customer_name}}, your order {{order_number}} has been received by Anand Jewellers. Thank you for choosing us."

ORDER_READY:
"Dear {{customer_name}}, your Anand Jewellers order {{order_number}} is ready for collection. Please contact us if you need any assistance."

ORDER_DELIVERED:
"Thank you {{customer_name}} for choosing Anand Jewellers. Order {{order_number}} has been marked as delivered."

Use template variables safely.

Do not hard-code customer-specific values into frontend code.

Provide backend template rendering.

---

# PROMPT 13 — Notification Center

Create a Notifications page.

Show:

- notification type
- customer
- order
- channel
- status
- created date
- sent date
- failure reason

Filters:

- SENT
- QUEUED
- FAILED
- date
- customer
- order

Add retry for failed notifications.

Retry must be safe and idempotent.

---

# PROMPT 14 — Inventory Module

Create an inventory module suitable for a jewellery store.

First inspect the current data model and avoid duplicating existing concepts.

Support:

- product/item SKU
- item name
- category
- description
- quantity
- available quantity
- reserved quantity
- status
- optional weight
- optional purity
- optional price
- optional image

Categories can include:

- Gold
- Diamond
- Silver
- Platinum
- Other

Features:

- add inventory item
- edit
- search
- filter
- stock adjustment
- reserve stock
- release stock
- low-stock indication

Do not invent financial calculations if the current business requirements do not define them.

---

# PROMPT 15 — Inventory + Order Integration

Connect inventory and orders where appropriate.

When an order consumes inventory:

- reserve the required quantity
- prevent negative stock
- release reservation on cancellation
- consume reserved stock on delivery

Use database transactions.

Do not allow concurrent requests to corrupt stock quantities.

If exact inventory consumption cannot be determined from the current order model, preserve the order workflow and introduce an explicit reservation field rather than guessing.

---

# PROMPT 16 — Search

Implement application-wide useful search.

Customer search:

- name
- phone

Order search:

- order number
- customer name
- phone

Inventory search:

- SKU
- name
- category

Use backend search endpoints for large datasets.

Avoid downloading the entire database into the browser just to filter.

---

# PROMPT 17 — Reports

Create a Reports page.

Include:

- orders by status
- orders by date
- ready orders
- pending orders
- delivered orders
- customer growth
- repeat customers
- notification success/failure

Use real database queries.

Provide date filters:

- Today
- Last 7 days
- Last 30 days
- This month
- Custom range

Do not expose sensitive information unnecessarily.

---

# PROMPT 18 — Audit Trail

Implement audit logging for important actions.

Track:

- customer created
- customer updated
- order created
- order updated
- order status changed
- item status changed
- notification sent
- notification failed
- inventory adjusted

Store:

- event type
- entity
- entity ID
- timestamp
- user if available
- metadata

Do not log passwords, tokens, API keys, or sensitive secrets.

---

# PROMPT 19 — Authentication and Authorization

Review the current authentication implementation.

Improve it without breaking existing login.

Support appropriate roles if the architecture permits:

- ADMIN
- STAFF

Define permissions clearly.

Examples:

ADMIN:
- all functionality

STAFF:
- customers
- orders
- item tracking
- notifications
- limited inventory

Do not expose admin-only APIs merely by hiding buttons in the frontend.

Enforce authorization on the backend.

---

# PROMPT 20 — Validation and Error Handling

Implement consistent backend validation.

Handle:

- invalid phone
- duplicate customer
- missing customer
- invalid order
- invalid item
- invalid status transition
- insufficient inventory
- notification failure
- database errors

Frontend should show useful messages rather than raw exceptions.

Create a consistent API error format if the current backend does not already have one.

---

# PROMPT 21 — Loading / Empty / Error UX

Audit every major page.

Every API-driven page should have:

- loading state
- empty state
- error state
- retry
- success feedback

Avoid blank screens.

Examples:

No customers:
" No customers yet. Add your first customer."

No orders:
"No orders yet. Create an order to start tracking jewellery work."

No notifications:
"No notifications found."

---

# PROMPT 22 — Responsive UI

Make the application usable on:

- desktop
- laptop
- tablet
- mobile

The desktop layout should remain similar to the current screenshots.

Mobile should:

- collapse navigation
- make tables horizontally scrollable or convert rows to cards
- keep buttons usable
- preserve forms
- avoid text overflow

Do not sacrifice desktop usability.

---

# PROMPT 23 — Dashboard Visual Polish

Apply the following visual direction.

Header:

- dark navy
- Anand Jewellers branding
- Dashboard
- Customers
- Orders
- Inventory
- Notifications
- Reports
- Settings
- Logout

Dashboard:

- page title
- KPI cards
- recent orders
- status summary
- quick actions
- charts where useful

Cards:

- subtle border
- light shadow
- rounded corners
- clear hierarchy

Status badges:

OPEN
IN_PROGRESS
READY
DELIVERED
CANCELLED

Use accessible contrast.

Do not overuse animations.

---

# PROMPT 24 — API Documentation

Review the backend APIs and make them understandable.

Add/update OpenAPI descriptions where supported.

Document:

- authentication
- customers
- orders
- items
- inventory
- notifications
- reports

Use clear request/response schemas.

Do not expose secrets.

---

# PROMPT 25 — Database Migration Safety

Review every database change.

For every schema change:

- create a migration
- make it repeatable/safe
- preserve existing data
- provide sensible defaults where required
- avoid destructive migration unless explicitly necessary

Verify migrations on a clean database and an existing seeded database.

---

# PROMPT 26 — Seed Data

Improve development seed data.

Create realistic demo data:

Customers:
- multiple customers
- WhatsApp opt-in variations

Orders:
- OPEN
- IN_PROGRESS
- READY
- DELIVERED

Items:
- rings
- chains
- bangles
- earrings
- pendants

Notifications:
- sent
- queued
- failed

Inventory:
- available
- reserved
- low stock

Do not use real customer personal information in committed seed data.

---

# PROMPT 27 — Docker End-to-End

Verify the full Docker architecture.

Expected services may include:

- frontend
- backend
- worker
- postgres
- redis
- minio
- nginx

Run:

`docker compose build`

`docker compose up -d`

`docker compose ps`

Check logs for every service.

Verify:

- frontend reachable
- backend reachable through Nginx
- PostgreSQL healthy
- Redis connected
- Celery ready
- MinIO available if used
- API calls succeed through Nginx

Fix Docker issues rather than bypassing Docker.

---

# PROMPT 28 — Environment Configuration

Review `.env.example`.

Ensure secrets are configuration-driven.

Never hard-code:

- NVIDIA API keys
- WhatsApp tokens
- database passwords
- JWT secrets
- MinIO credentials
- cloud credentials

Use environment variables.

Example:

NVIDIA_API_KEY=replace_me

WHATSAPP_API_TOKEN=replace_me

DATABASE_URL=replace_me

REDIS_URL=redis://redis:6379/0

Do not commit `.env`.

---

# PROMPT 29 — NVIDIA/GLM Coding Agent Integration

This prompt is for the coding-agent environment, not the application runtime.

Use the NVIDIA API key through an environment variable only.

Never put the key directly into source code.

If using NVIDIA-hosted GLM through an OpenAI-compatible API, configure the coding agent according to the current NVIDIA API documentation and the model endpoint available to the account.

The coding agent must have access to the project directory so it can:

- read files
- search the repository
- edit files
- run commands
- inspect build errors
- run tests
- iterate on failures

The coding agent must modify the existing repository directly.

Do not generate a replacement project in a separate directory.

---

# PROMPT 30 — Automated Regression Testing

Add or improve tests for:

Backend:

- authentication
- customer CRUD
- customer search
- order creation
- order status
- item status
- inventory
- notification queueing
- validation

Frontend:

- login
- customer creation
- customer search
- order creation
- order detail
- status updates

Integration:

- backend + PostgreSQL
- backend + Redis/Celery where practical

Run all available tests.

Fix failures.

---

# PROMPT 31 — Security Review

Perform a security review.

Check:

- authentication
- authorization
- JWT/session handling
- CORS
- SQL injection
- input validation
- file upload validation
- path traversal
- secrets
- logs
- error messages
- rate limiting where appropriate
- WhatsApp webhook/security if applicable

Never print API keys or credentials.

Do not make destructive security changes without checking compatibility.

---

# PROMPT 32 — Performance Review

Review:

- database queries
- N+1 queries
- pagination
- indexes
- dashboard queries
- order search
- customer search
- notification queries

Add indexes where justified.

Do not optimize by guessing.

Use query structure and existing schema to identify real bottlenecks.

---

# PROMPT 33 — Final End-to-End User Journey

Test the complete workflow as a real Anand Jewellers staff user:

1. Login
2. Open Dashboard
3. Add customer
4. Enable WhatsApp opt-in
5. Create order
6. Add multiple jewellery items
7. Save order
8. Open order
9. Move item to IN_PROGRESS
10. Move item to READY
11. Verify order status
12. Queue WhatsApp notification
13. Process notification with worker
14. View notification history
15. Mark order DELIVERED
16. Verify dashboard statistics
17. Search customer
18. Open customer profile
19. View order history
20. Search order
21. View reports
22. Check inventory

Fix every issue discovered during this workflow.

---

# PROMPT 34 — Final UI Review Against the Reference Screenshots

Review the existing UI against the Anand Jewellers screenshots supplied in the conversation.

Preserve the successful characteristics:

- dark navigation bar
- Anand Jewellers branding
- clean white/light background
- large page headings
- KPI cards
- professional tables
- rounded cards
- status badges
- simple navigation
- spacious layout

Improve the application beyond the current screenshots by adding the completed features from this prompt pack.

Do not turn the UI into an unrelated design.

---

# PROMPT 35 — Final Production Readiness Pass

Perform a final repository review.

Check:

- no TODOs for required features
- no fake/mock data in production paths
- no hard-coded secrets
- no broken links
- no broken frontend routes
- no unused critical API
- no missing database migration
- no startup errors
- no broken Docker service
- no failed worker
- no console errors for normal workflows

Run:

`docker compose build`

`docker compose up -d`

`docker compose ps`

Then inspect:

`docker compose logs backend --tail=100`

`docker compose logs worker --tail=100`

`docker compose logs nginx --tail=100`

Verify the complete application from the browser.

---

# PROMPT 36 — Final Implementation Report

Do not change code in this prompt unless required to fix a final issue.

Produce a concise final report containing:

1. Completed features
2. Frontend modules
3. Backend modules
4. Database tables/models
5. API endpoints
6. Background jobs
7. WhatsApp integration status
8. Inventory status
9. Authentication/authorization status
10. Docker services
11. Tests executed
12. Known limitations
13. Configuration variables required
14. Exact commands to start the application

Also list any feature that remains intentionally incomplete.

---

# IMPORTANT AGENT RULES

## Rule 1 — Understand before editing

Always inspect existing files before making changes.

## Rule 2 — Do not rebuild unnecessarily

The application already contains:

- Angular/frontend
- FastAPI/backend
- PostgreSQL
- Redis
- Celery
- MinIO
- Nginx
- Docker Compose

Reuse them.

## Rule 3 — Real integration

A UI feature is not complete if it only changes HTML/CSS.

Every feature requiring data must connect:

Frontend -> API -> Service -> Database

For asynchronous notifications:

Frontend -> API -> Celery -> Redis -> WhatsApp provider

## Rule 4 — Preserve working features

Do not remove:

- login
- dashboard
- customers
- orders
- Docker configuration
- existing APIs
- working notification architecture

unless there is a concrete reason and the replacement is tested.

## Rule 5 — No secrets

Never put API keys in:

- TypeScript
- Python
- Dockerfile
- git
- README
- screenshots
- logs

Use `.env`.

## Rule 6 — Test after every meaningful change

At minimum, use the relevant:

`docker compose build`

`docker compose up -d`

`docker compose ps`

and inspect logs when something fails.

## Rule 7 — Fix root causes

If an API returns 500, investigate the backend/database instead of hiding the error in the frontend.

If Docker fails, diagnose the container/build/network issue.

If a UI page is empty, verify the API and database.

## Rule 8 — Do not create duplicate architecture

Before adding:

- a model
- endpoint
- service
- component
- notification provider
- storage system

search the repository for an existing implementation.

## Rule 9 — Keep changes incremental

Implement one prompt at a time.

After each prompt, verify the application still works.

## Rule 10 — Final goal

The final product should feel like a real jewellery-store customer/order management platform, not a prototype made only of static screens.

---

# CURRENT PROJECT START COMMANDS

From PowerShell:

`cd "C:\Users\ZMIT\Downloads\anand-jewellers-production-starter\anand-jewellers"`

Then:

`docker compose build`

`docker compose up -d`

`docker compose ps`

Open:

`http://localhost`

Useful diagnostics:

`docker compose logs backend --tail=100`

`docker compose logs worker --tail=100`

`docker compose logs nginx --tail=100`

`docker compose logs postgres --tail=100`

`docker compose logs redis --tail=100`

---

# HOW TO WORK WITH GLM

Give GLM:

"Read PROMPT 00 from ANAND_JEWELLERS_GLM_IMPLEMENTATION_PROMPTS.md and execute it against the current repository. Do not just explain the solution. Inspect the code and make the required changes. After completion, report the files changed and tests performed."

After it finishes, give:

"Now execute PROMPT 01 from ANAND_JEWELLERS_GLM_IMPLEMENTATION_PROMPTS.md. Follow the same rules."

Continue sequentially through the prompts.

If GLM stops because of context limits, tell it:

"Continue from the current repository state. Re-read the current implementation and continue the active prompt. Do not restart or recreate the project."

If GLM reports a build error, tell it:

"Investigate and fix the actual root cause in the repository. Do not work around the error by removing the feature. Run the relevant build/test again and continue."

If GLM wants to rewrite the project:

"Do not rewrite the project. Preserve the existing architecture and modify the current files incrementally."

---

# SECURITY NOTE

If an NVIDIA API key has ever been pasted into chat, a terminal screenshot, a repository, or a source file, rotate/revoke that key and create a new one.

Use only:

`NVIDIA_API_KEY=<your-new-key>`

in your local environment.

Never commit the real key to Git.
