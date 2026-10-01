from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.security import current_user
from app.db.session import get_db
from app.models.customer import Customer
from app.models.dashboard_month import DashboardMonth
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.order import OrderOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
IST = ZoneInfo("Asia/Kolkata")


def _month_bounds(value: str) -> tuple[datetime, datetime, date, int]:
    try:
        year_text, month_text = value.split("-", 1)
        year, month = int(year_text), int(month_text)
        if len(year_text) != 4 or not 1 <= month <= 12:
            raise ValueError
        days = monthrange(year, month)[1]
        start_local = datetime(year, month, 1, tzinfo=IST)
        if month == 12:
            end_local = datetime(year + 1, 1, 1, tzinfo=IST)
        else:
            end_local = datetime(year, month + 1, 1, tzinfo=IST)
        return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc), start_local.date(), days
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Choose a month in YYYY-MM format")


@router.get("/summary")
def summary(
    month: str | None = Query(default=None, description="Optional month in YYYY-MM format"),
    db: Session = Depends(get_db),
    _=Depends(current_user),
):
    start = end = None
    first_day = None
    day_count = 0
    if month:
        start, end, first_day, day_count = _month_bounds(month)

    def in_period(query, column):
        if start is not None and end is not None:
            return query.filter(column >= start, column < end)
        return query

    order_status_query = in_period(db.query(Order.status, func.count(Order.id)).group_by(Order.status), Order.created_at)
    order_status = {str(status): int(count) for status, count in order_status_query.all()}

    item_status_query = db.query(OrderItem.status, func.count(OrderItem.id)).join(Order, Order.id == OrderItem.order_id).group_by(OrderItem.status)
    if start is not None and end is not None:
        item_status_query = item_status_query.filter(Order.created_at >= start, Order.created_at < end)
    item_status = {str(status): int(count) for status, count in item_status_query.all()}

    items_pending = sum(count for status, count in item_status.items() if status not in {"READY", "DELIVERED", "CANCELLED"})
    items_ready = item_status.get("READY", 0)
    items_delivered = item_status.get("DELIVERED", 0)

    orders_query = in_period(db.query(Order), Order.created_at)
    orders_total = orders_query.count()
    recent = orders_query.options(joinedload(Order.items), joinedload(Order.customer)).order_by(Order.id.desc()).limit(10).all()

    customers_query = in_period(db.query(Customer), Customer.created_at)
    customers_total = customers_query.count()
    recent_customers = customers_query.order_by(Customer.id.desc()).limit(5).all()

    low_stock = db.query(Product).filter(
        Product.is_active.is_(True),
        Product.quantity - Product.reserved_quantity <= Product.min_quantity,
    ).order_by((Product.quantity - Product.reserved_quantity).asc()).limit(10).all()
    low_stock_out = [{
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "quantity": product.quantity,
        "reserved_quantity": product.reserved_quantity,
        "available_quantity": product.available_quantity,
        "min_quantity": product.min_quantity,
    } for product in low_stock]

    if first_day is not None:
        counts: dict[str, int] = {}
        created_rows = orders_query.with_entities(Order.created_at).all()
        for (created_at,) in created_rows:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            key = created_at.astimezone(IST).date().isoformat()
            counts[key] = counts.get(key, 0) + 1
        orders_over_time = [
            {"date": (first_day + timedelta(days=offset)).isoformat(), "count": counts.get((first_day + timedelta(days=offset)).isoformat(), 0)}
            for offset in range(day_count)
        ]
    else:
        today = datetime.now(timezone.utc).astimezone(IST).date()
        start_day = today - timedelta(days=13)
        orders_over_time = [{"date": (start_day + timedelta(days=offset)).isoformat(), "count": 0} for offset in range(14)]
        since = datetime.combine(start_day, datetime.min.time(), tzinfo=IST).astimezone(timezone.utc)
        recent_rows = db.query(Order.created_at).filter(Order.created_at >= since).all()
        for (created_at,) in recent_rows:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            key = created_at.astimezone(IST).date().isoformat()
            offset = (date.fromisoformat(key) - start_day).days
            if 0 <= offset < len(orders_over_time):
                orders_over_time[offset]["count"] += 1

    def notification_count(status: str) -> int:
        query = db.query(func.count(Notification.id)).filter(Notification.status == status)
        query = in_period(query, Notification.created_at)
        return int(query.scalar() or 0)

    result = {
        "customers_total": customers_total,
        "orders_total": orders_total,
        "orders_open": order_status.get("OPEN", 0),
        "orders_in_progress": order_status.get("IN_PROGRESS", 0),
        "orders_partially_ready": order_status.get("PARTIALLY_READY", 0),
        "orders_ready": order_status.get("READY", 0),
        "orders_delivered": order_status.get("DELIVERED", 0),
        "orders_cancelled": order_status.get("CANCELLED", 0),
        "items_pending": items_pending,
        "items_ready": items_ready,
        "items_delivered": items_delivered,
        "items_by_status": item_status,
        "orders_by_status": order_status,
        "orders_over_time": orders_over_time,
        "low_stock": low_stock_out,
        "notifications_queued": notification_count("QUEUED"),
        "notifications_sent": notification_count("SENT"),
        "notifications_failed": notification_count("FAILED"),
        "recent_orders": [OrderOut.model_validate(order).model_dump() for order in recent],
        "recent_customers": [{"id": customer.id, "name": customer.name, "phone": customer.phone, "whatsapp_opt_in": customer.whatsapp_opt_in} for customer in recent_customers],
    }
    if month:
        result["month"] = month
        snapshot = db.query(DashboardMonth).filter(DashboardMonth.month == month).first()
        if snapshot is None:
            snapshot = DashboardMonth(month=month, details=jsonable_encoder(result))
            db.add(snapshot)
        else:
            snapshot.details = jsonable_encoder(result)
        snapshot.saved_at = datetime.now(IST)
        db.commit()
        db.refresh(snapshot)
        result["saved_at"] = snapshot.saved_at.isoformat()
    return result
