# Anand Jewellers — Customer & Jewellery Order Creation Implementation

## Instructions for the Coding Agent

Read this document completely before making any changes.

You are working inside the existing Anand Jewellers project.

The goal is to implement the complete **Customer + Jewellery Order Creation** workflow using the application's existing architecture.

---

## 1. IMPORTANT RULES

- Work only on the Anand Jewellers project in the current directory.
- Inspect the existing implementation before changing anything.
- Reuse existing architecture, components, services, APIs, models, validation, styling, and patterns wherever possible.
- Do NOT create a parallel architecture.
- Do NOT replace Angular, FastAPI, PostgreSQL, Docker, or the existing authentication system.
- Do NOT remove existing functionality.
- Do NOT break existing APIs.
- Do NOT modify Docker Compose infrastructure unless absolutely required.
- Do NOT expose or hard-code secrets.
- Keep the UI responsive for desktop, tablet, and mobile.
- Follow the existing Angular 20 + SCSS coding style.
- Follow the existing FastAPI + SQLAlchemy + Pydantic architecture.
- Run appropriate tests/build checks after implementation.
- Fix errors caused by the changes.
- Do NOT run `docker compose down`.
- Do NOT delete or reset the database.
- Do NOT modify production credentials.

---

# 2. FEATURE: CUSTOMER + JEWELLERY ORDER CREATION

Improve the order creation workflow so staff can create an order for a customer and add multiple jewellery items to the same order.

Example:

Customer:
- Name: Ramesh
- Mobile: 9876543210
- Email: example@email.com
- Address: Customer address

Order:
- Expected Delivery Date: 15-Nov-2026
- Order Notes: Wedding jewellery

Items:
1. Ring — Quantity 2
2. Chain — Quantity 1
3. Bangle — Quantity 2

One customer order must contain multiple `OrderItem` records.

Do NOT create one separate order for every jewellery item.

---

# 3. CUSTOMER INFORMATION

The order creation screen must contain:

- Customer Name
- Mobile Number
- Email Address
- Address
- WhatsApp Opt-In

## Customer lookup

The mobile number is the primary customer lookup field because the existing Customer model uses phone as a unique identifier.

Behavior:

### Existing customer

If the mobile number belongs to an existing customer:

- Find the customer.
- Automatically populate:
  - Name
  - Email
  - Address
  - WhatsApp Opt-In
- Allow staff to edit customer information if required.

### New customer

If the mobile number does not exist:

- Allow staff to enter the new customer information.
- Create the customer using the existing customer API/model.

### Duplicate prevention

Do not create duplicate customers with the same mobile number.

Reuse existing customer APIs and validation wherever possible.

---

# 4. ORDER INFORMATION

The order must contain:

- Expected Delivery Date
- Order Notes

Use the existing Order model fields:

- `expected_delivery_date`
- `notes`
- `customer_id`

Do not create duplicate fields if the existing model already supports them.

---

# 5. MULTIPLE JEWELLERY ITEMS

The order creation screen must allow multiple jewellery items.

The user must be able to:

- Add jewellery item
- Remove jewellery item
- Edit jewellery item
- Add multiple items without an artificial low limit

Each item should support the existing `OrderItem` fields where applicable.

At minimum, the UI must clearly provide:

- Item Type
- Quantity
- Description
- Expected Date
- Design / Design Details
- Gold Purity
- Net Weight
- Estimated Value

Advanced financial/technical fields should remain optional if the existing application treats them as optional.

---

# 6. ITEM TYPE

Provide an easy item-type selector.

Include common jewellery types:

- Ring
- Chain
- Necklace
- Bangle
- Bracelet
- Earrings
- Pendant
- Anklet
- Nose Ring
- Other

If the existing Product/category system already provides an appropriate source, reuse it instead of duplicating business logic.

If `Other` is selected, allow staff to enter a custom description.

---

# 7. ORDER ITEM STATUS

When a new order item is created, use the existing lifecycle.

Default new items to:

`ORDER_CREATED`

Do NOT create a new status system.

Reuse the existing statuses:

- ORDER_CREATED
- SENT_TO_WORKSHOP
- IN_PROGRESS
- QUALITY_CHECK
- REWORK_REQUIRED
- READY
- DELIVERED
- ON_HOLD
- CANCELLED

---

# 8. COMPLETE ORDER CREATION WORKFLOW

When the user clicks:

**Create Order**

the application should:

1. Validate customer information.
2. Find the existing customer OR create a new customer.
3. Create the order.
4. Create all jewellery order items belonging to that order.
5. Maintain this relationship:

```text
Customer
   |
   └── Order
         |
         ├── Order Item 1
         ├── Order Item 2
         ├── Order Item 3
         └── ...
```

6. Show a success message.
7. Navigate to the newly created order details page.
8. Display the generated order number.

Use existing backend endpoints wherever possible.

If the existing `POST /api/orders` endpoint already supports nested order items, use it.

Only modify the backend if the current API cannot support the required workflow.

---

# 9. VALIDATION

Implement proper frontend and backend validation.

Required:

- Customer name
- Mobile number
- Expected delivery date
- At least one jewellery item
- Item type
- Quantity

Quantity must be greater than zero.

Mobile number must have appropriate validation.

Expected delivery date must be a valid date.

Show clear user-friendly validation messages.

Do not rely only on frontend validation.

Reuse or add appropriate backend Pydantic validation where required.

---

# 10. USER EXPERIENCE

Create a clean, professional workflow suitable for jewellery-store staff.

Suggested layout:

```text
CREATE NEW ORDER
--------------------------------------------------

CUSTOMER INFORMATION

Customer Mobile *
[ Search / Enter Mobile ]

Customer Name *
[                         ]

Email
[                         ]

Address
[                         ]

WhatsApp Notifications
[ ✓ ]

--------------------------------------------------

ORDER INFORMATION

Expected Delivery Date *
[                         ]

Order Notes
[                         ]

--------------------------------------------------

JEWELLERY ITEMS

[ + Add Jewellery Item ]

Item 1
--------------------------------------------------
Item Type       [ Ring ▼ ]
Quantity        [ 2 ]
Description     [           ]
Expected Date   [           ]
Gold Purity     [ 22K ▼ ]
Net Weight      [           ]
Estimated Value [           ]
Design Details  [           ]

                         [ Remove ]

--------------------------------------------------

Item 2
--------------------------------------------------
Item Type       [ Chain ▼ ]
Quantity        [ 1 ]
...

--------------------------------------------------

[ + Add Jewellery Item ]

--------------------------------------------------

              [ Cancel ] [ Create Order ]
--------------------------------------------------
```

Make the interface responsive and consistent with the existing application.

Use the existing shared components, toast service, styles, form patterns, and UI conventions wherever possible.

---

# 11. EXISTING BACKEND/API REUSE

Before creating any new endpoint, inspect the existing:

- Customer APIs
- Order APIs
- Order Item APIs
- Schemas
- Services
- Database models

Relevant existing endpoints include:

```text
POST   /api/customers
GET    /api/customers
GET    /api/customers/{id}
PATCH  /api/customers/{id}

POST   /api/orders
GET    /api/orders/{id}

POST   /api/orders/{id}/items
PATCH  /api/orders/items/{item_id}
DELETE  /api/orders/items/{item_id}

PATCH  /api/orders/items/{item_id}/status
```

Reuse these wherever appropriate.

Only add or modify endpoints when necessary.

Do not duplicate existing functionality.

---

# 12. ERROR HANDLING

Handle:

- Existing customer
- Invalid mobile number
- Invalid customer data
- Invalid order data
- Missing jewellery item
- Invalid quantity
- Backend validation errors
- Network errors
- Duplicate submission

Prevent accidental duplicate order creation when the Create Order button is clicked multiple times.

Use the existing toast/error handling system.

---

# 13. DO NOT BREAK EXISTING FEATURES

After implementation verify that these continue working:

- Login
- Customer list
- Customer details
- Product management
- Existing order list
- Existing order details
- Order item status updates
- QR functionality
- Photo functionality
- Notification functionality
- Dashboard
- Reports

---

# 14. DATABASE / MIGRATIONS

Before changing database models:

1. Inspect the existing models.
2. Determine whether the current schema already supports the feature.
3. Avoid unnecessary migrations.

If a migration is genuinely required:

- Create a proper Alembic migration.
- Do not delete existing data.
- Do not reset the database.
- Make the migration backward-safe where practical.

---

# 15. TESTING

After implementation:

1. Run frontend build/type checks.
2. Run backend tests if available.
3. Run relevant lint/validation checks.
4. Fix errors introduced by the implementation.
5. Verify API integration.
6. Verify form validation.
7. Verify multiple order items.
8. Verify existing customer lookup.
9. Verify new customer creation.
10. Verify order creation.
11. Verify navigation to order details.

Do NOT:

- Run `docker compose down`
- Delete the database
- Reset database data
- Modify production credentials

---

# 16. FINAL REPORT

When implementation is complete, provide a concise report containing:

## Files changed
List every modified/created file.

## Frontend changes
Explain the Angular changes.

## Backend changes
Explain FastAPI/API changes.

## Database changes
Explain migrations/model changes, or explicitly state that none were required.

## API changes
List modified or newly added endpoints.

## Testing
List commands/checks executed and their results.

## Remaining issues
List anything that could not be completed.

---

# 17. IMPLEMENTATION PRINCIPLE

Do not stop after creating the UI.

Implement the complete working flow:

```text
Customer lookup
      ↓
Existing customer OR new customer
      ↓
Order creation
      ↓
Multiple jewellery items
      ↓
Backend validation
      ↓
Database transaction
      ↓
Order created
      ↓
Order items created
      ↓
Success notification
      ↓
Order details page
```

Before changing files, inspect the relevant existing implementation.

Then implement the feature end-to-end.
