"""Type-dispatching property extractor for the Bills Notion schema.

Notion property values are NOT uniform:
  - title / rich_text   -> list of {"plain_text": ..., "text": {...}} objects
  - status / date       -> dict with named sub-keys
  - number              -> raw int / float / None
  - checkbox            -> raw bool / None

A naive `val = row["properties"][key][ptype]; val.get(sub)` will crash with
AttributeError: 'list' object has no attribute 'get' (for title/rich_text)
or AttributeError: 'int' object has no attribute 'get' (for number).

Usage:
    from extract_prop import get_name, get_due_date, get_paid, get_price, get_payment_ref

    for row in rows:
        print(get_name(row), get_due_date(row), get_price(row), get_paid(row))
"""
from __future__ import annotations


def get_name(row: dict) -> str:
    """Title -> first plain_text, or '' if empty."""
    title = row["properties"].get("Name", {}).get("title") or []
    return title[0]["plain_text"] if title else ""


def get_due_date(row: dict) -> str:
    """date -> ISO start string (YYYY-MM-DD, the actual due date including day-of-month). Empty string if null."""
    return (row["properties"].get("Due Date", {}).get("date") or {}).get("start", "")


def get_due_day(row: dict) -> int | None:
    """Day-of-month from Due Date. None if Due Date is null."""
    s = get_due_date(row)
    return int(s[8:10]) if s else None


def get_paid(row: dict) -> str:
    """status -> name string. One of 'Not started' or 'Done'."""
    return (row["properties"].get("Paid", {}).get("status") or {}).get("name", "")


def get_price(row: dict) -> int | None:
    """number -> raw int (COP) or None."""
    return row["properties"].get("Price", {}).get("number")


def get_payment_ref(row: dict) -> str:
    """rich_text -> first plain_text, or '' if empty."""
    rt = row["properties"].get("Electronic Payment Code", {}).get("rich_text") or []
    return rt[0]["plain_text"] if rt else ""


def get_temporary(row: dict) -> bool:
    """checkbox -> raw bool. False if absent or not a checkbox."""
    return bool(row["properties"].get("Temporary", {}).get("checkbox", False))


def fmt_price(n: int | None) -> str:
    return f"${n:,.0f} COP" if n is not None else "—"
