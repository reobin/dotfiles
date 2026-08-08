"""bill_receipt.py — process an email payment receipt end-to-end.

Sender-agnostic: Nu Colombia, PSE, Aval Pasarela, AvalPay Center, ePayco,
Telefónica Colombia, PayU, and any future gateway that sends a "you paid X"
email. The cron's job is to read INBOX, find these, dispatch to this helper
per receipt, and report.

For each receipt:

  1. Read the .eml from disk (or fetch from Bridge).
  2. Detect the recipe (Nu / PSE / ePayco / Telefónica / Aval) by sender + subject.
  3. Extract structured fields: empresa (biller name in receipt body), monto, dedup_key.
  4. Map empresa -> Notion row via ~/.hermes/config/receipt_billers.json.
  5. Look up the row by Name in the receipt's month (default: current month).
  6. PATCH the row: Paid = Done, Price = real amount, Electronic Payment Code if EMCALI.
  7. Render a phone-friendly PNG screenshot, upload to Notion, append as file block.

The cron's report uses the result dict to decide what bullet to print.

CLI form (for ad-hoc / archive re-pass):
  python3 bill_receipt.py --eml /tmp/x.eml --month 2026-07 [--dry-run]
  python3 bill_receipt.py --message-id 1234 --month 2026-07
"""

from __future__ import annotations

import os
import re
import sys
import json
import uuid
import imaplib
import urllib.request
import urllib.error
import subprocess
import ssl
import argparse
import hashlib
from pathlib import Path
from email import policy
import email

# ---------- Notion ----------
NOTION_VERSION = "2025-09-03"
DS = "b6cc5019-662a-8319-a015-8798f7095c6d"
RECEIPT_BILLERS_PATH = os.path.expanduser("~/.hermes/config/receipt_billers.json")


def _notion_key():
    return os.environ["NOTION" + "_API_KEY"]


def notion_call(url, method, body, headers=None):
    h = {
        "Authorization": "Bearer " + _notion_key(),
        "Notion-Version": NOTION_VERSION,
    }
    if body is not None or method != "GET":
        h["Content-Type"] = "application/json"
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in h.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        # surface the error body for debug
        body_text = ""
        try:
            body_text = e.read().decode("utf-8", "replace")[:500]
        except Exception:
            pass
        raise RuntimeError(f"Notion {method} {url} -> {e.code}: {body_text}") from e


# ---------- Email parsing ----------
def parse_eml(raw_bytes: bytes) -> dict:
    """Return a normalized dict with sender/subject/body-text/date/parts."""
    import html as html_lib
    msg = email.message_from_bytes(raw_bytes, policy=policy.default)
    body_text = None
    for part in msg.walk():
        ct = part.get_content_type()
        if ct == "text/plain" and body_text is None:
            body_text = part.get_content() or ""
        elif ct == "text/html" and body_text is None:
            html = part.get_content() or ""
            t = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
            t = re.sub(r"<script[^>]*>.*?</script>", " ", t, flags=re.S | re.I)
            t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
            t = re.sub(r"</p>", "\n\n", t, flags=re.I)
            t = re.sub(r"<[^>]+>", " ", t)
            t = html_lib.unescape(t)
            t = (
                t.replace("&nbsp;", " ")
                .replace("&amp;", "&")
            )
            body_text = re.sub(r"[ \t]+", " ", t)
            body_text = re.sub(r"\n{3,}", "\n\n", body_text).strip()
    return {
        "from": msg["From"] or "",
        "subject": msg["Subject"] or "",
        "date": msg["Date"] or "",
        "body": body_text or "",
    }


# ---------- Recipe detection ----------
# Each recipe: function(parsed_email) -> {"biller": str, "amount": int, "dedup_key": str, "raw": dict}
# A receipt is "matched" if the recipe finds a biller name + amount.

def _amount_from_str(s: str) -> int | None:
    """Parse a money string into integer COP.

    Handles both formats:
      Colombian: '1.005.000,00' (period=thousands, comma=decimal)
      US:        '1,005,000.00' (comma=thousands, period=decimal)
      Plain:     '1005000'
      Decimal-only: '20,00' (Colombia) or '20.00' (US)

    Heuristic: the LAST separator wins. If it's followed by exactly 2 digits,
    it's the decimal (drop everything after). Otherwise it's a thousands
    separator (drop it).
    """
    if not s:
        return None
    s = s.strip()
    # find last separator
    last_period = s.rfind(".")
    last_comma = s.rfind(",")
    sep = max(last_period, last_comma)
    if sep == -1:
        # no separator
        digits = re.sub(r"[^\d]", "", s)
        return int(digits) if digits else None
    sep_char = s[sep]
    after = s[sep + 1:]
    if len(after) == 2 and after.isdigit():
        # decimal — drop everything from sep onward
        integer_part = s[:sep]
    else:
        # thousands — drop the sep
        integer_part = s[:sep] + s[sep + 1:]
    digits = re.sub(r"[^\d]", "", integer_part)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def recipe_nu_html_body(p: dict) -> dict | None:
    """Nu Colombia payment receipt: subject 'comprobante de pago de servicio', body has Empresa + Monto."""
    body = p["body"]
    if "comprobante" not in p["subject"].lower() and "comprobante del pago" not in body.lower():
        return None
    biller = _opt(r"Empresa a la cual se realizar[áa] el pago:\s*([^\n]+)", body)
    if not biller:
        return None
    m = re.search(r"Monto:\s*\$?([\d\.,]+)", body)
    if not m:
        return None
    amount = _amount_from_str(m.group(1))
    if not amount:
        return None
    amount_str = m.group(1)
    # Dedup key: the codigo_operacion (UUID) when present, else hash of (date, biller, amount)
    dedup = _opt(r"C[oó]digo de operaci[oó]n:\s*([\w-]+)", body) or _hash_dedup(p["date"], biller, amount)
    ref = (
        _opt(r"N[úu]mero de cuenta o referencia de pago:\s*([^\n]+)", body)
        or _opt(r"N[úu]mero de pago electr[oó]nico:\s*([^\n]+)", body)
        or _opt(r"N[úu]mero de tel[ée]fono:\s*([^\n]+)", body)
    )
    return {
        "biller": biller,
        "amount": amount,
        "amount_str": amount_str,
        "dedup_key": dedup,
        "extra": {
            "ref": ref,
            "pagador": _opt(r"^Nombre:\s*([^\n]+)", body, ""),
            "metodo": _opt(r"M[ée]todo de pago:\s*([^\n]+)", body),
            "codigo_operacion": dedup if "-" in dedup else None,
        },
    }


def recipe_pse_plain_text(p: dict) -> dict | None:
    """PSE / ACH Colombia: 'PSE - Transacción Aprobada' (achcolombia.com.co)."""
    body = p["body"]
    if "PSE" not in p["subject"] and "ACH Colombia" not in p["from"]:
        if "Valor" not in body or "Empresa" not in body:
            return None
    m = re.search(r"Valor:\s*\$?\s*([\d\.,]+)", body)
    if not m:
        return None
    amount = _amount_from_str(m.group(1))
    if not amount:
        return None
    amount_str = m.group(1)
    # PSE's "Empresa" is the payment processor (GOU Payments, ACH operador).
    # The actual biller lives in "Descripcion" — prefer it.
    desc = _opt(r"Descripci[oó]n:\s*([^\n]+)", body)
    empresa = _opt(r"Empresa:\s*([^\n]+)", body)
    biller = desc or empresa
    if not biller:
        return None
    cus = _opt(r"CUS:\s*([\w]+)", body)
    dedup = cus or _hash_dedup(p["date"], biller, amount)
    return {
        "biller": biller.strip(),
        "amount": amount,
        "amount_str": amount_str,
        "dedup_key": dedup,
        "extra": {
            "cus": cus,
            "procesador": empresa,
            "descripcion": desc,
            "fecha": _opt(r"Fecha de la transacci[oó]n:\s*([\d/]+)", body),
        },
    }


def recipe_aval_plain_text(p: dict) -> dict | None:
    """Aval Pay Center / Pasarela de Pagos Aval."""
    body = p["body"]
    frm = p["from"].lower()
    if "aval" not in frm and "pagosaval" not in frm and "avalpay" not in frm:
        return None
    # Field values may be on the next line (Aval Pasarela uses table-style layout).
    # Allow label + optional whitespace + optional newline + value.
    def _field(label: str) -> str | None:
        m = re.search(rf"{re.escape(label)}\s*\r?\n\s*([^\r\n]+)", body, re.I)
        if m:
            return m.group(1).strip()
        # fallback: label and value on the same line
        m = re.search(rf"{re.escape(label)}\s+([^\r\n]+)", body, re.I)
        return m.group(1).strip() if m else None

    # AvalPasarela uses "Empresa \n <name>" table layout. AvalPay uses an inline
    # sentence: "del servicio <name> , por valor de $..." Try the most specific
    # pattern first (del servicio + comma), then the table form, then the generic
    # "servicio" label.
    m = re.search(r"del servicio\s+([^,]+?)(?:\s*,|\s+por valor)", body, re.I)
    if m:
        biller = m.group(1).strip()
    else:
        biller = _field("Empresa") or _field("servicio")
    # Same pattern for amount (may be "Valor de transacción" or "por valor de")
    m = re.search(r"(?:Valor de transacci[oó]n|por valor de)\s*\r?\n?\s*\$?\s*([\d\.,]+)", body, re.I)
    if not m:
        return None
    amount = _amount_from_str(m.group(1))
    if not amount:
        return None
    amount_str = m.group(1)
    id_txn = _field("ID Transacción") or _opt(r"transacci[oó]n con ID n[úu]mero\s+([\d]+)", body, None)
    if not id_txn:
        id_txn = _opt(r"ID (?:n[úu]mero\s*)?(?:transacci[oó]n\s*)?([\d]+)", body, None)
    dedup = id_txn or _hash_dedup(p["date"], biller, amount)
    return {
        "biller": biller,
        "amount": amount,
        "amount_str": amount_str,
        "dedup_key": dedup,
        "extra": {
            "id_transaccion": id_txn,
            "descripcion": _field("Descripción") or _field("Descripcion"),
            "medio_pago": _field("Medio de pago"),
        },
    }


def recipe_epayco_html(p: dict) -> dict | None:
    """ePayco: 'Transacción #N ACEPTADA en ePayco' (epayco.com)."""
    body = p["body"]
    if "epayco" not in p["from"].lower() and "ePayco" not in p["subject"]:
        return None
    m = re.search(r"transacci[oó]n en\s+([^\.\n]+?)(?:\.|\s*transacci[oó]n|$)", body, re.I)
    if not m:
        return None
    biller = m.group(1).strip().rstrip(".")
    m = re.search(r"Total\s*\$?\s*([\d\.,]+)", body)
    if not m:
        return None
    amount = _amount_from_str(m.group(1))
    if not amount:
        return None
    amount_str = m.group(1)
    ref_epayco = _opt(r"Referencia ePayco\s+([\w-]+)", body)
    dedup = ref_epayco or _hash_dedup(p["date"], biller, amount)
    return {
        "biller": biller,
        "amount": amount,
        "amount_str": amount_str,
        "dedup_key": dedup,
        "extra": {
            "ref_epayco": ref_epayco,
            "medio_pago": _opt(r"Medio de pago\s+([^\n]+)", body),
        },
    }


def recipe_telefonica_plain_text(p: dict) -> dict | None:
    """Telefónica Colombia direct: 'Hemos recibido tu pago'."""
    body = p["body"]
    if "telefonica.com.co" not in p["from"].lower() and "Hemos recibido tu pago" not in p["subject"]:
        return None
    m = re.search(r"pago por\s*\$?\s*([\d\.,]+)", body)
    if not m:
        return None
    amount = _amount_from_str(m.group(1))
    if not amount:
        return None
    amount_str = m.group(1)
    account = _opt(r"cuenta\s+([\d]+)", body)
    dedup = _hash_dedup(p["date"], f"telefonica:{account}", amount) if account else _hash_dedup(p["date"], "telefonica", amount)
    return {
        "biller": "TELEFONICA (Movistar)",
        "amount": amount,
        "amount_str": amount_str,
        "dedup_key": dedup,
        "extra": {"account": account},
    }


RECIPES = [
    recipe_nu_html_body,
    recipe_pse_plain_text,
    recipe_aval_plain_text,
    recipe_epayco_html,
    recipe_telefonica_plain_text,
]


def detect_recipe(parsed: dict) -> dict | None:
    """Run all recipes; return the first match or None."""
    for r in RECIPES:
        result = r(parsed)
        if result:
            return {"recipe": r.__name__, "fields": result}
    return None


def _hash_dedup(*parts) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


# ---------- Biller map ----------
def load_receipt_billers() -> list[dict]:
    try:
        d = json.load(open(RECEIPT_BILLERS_PATH))
        return d.get("receipt_billers", [])
    except FileNotFoundError:
        return []


def find_biller_in_map(biller: str) -> dict | None:
    """Match a biller string from the receipt body to a Notion row via regex.

    The biller string from the receipt can be a single line (e.g. 'EDIFICIO PARQUE
    KRABI CRA 77 13A1 38 CALI VALLE') or a longer Descripción with extra context.
    We try a substring/regex match against the configured patterns.
    """
    for entry in load_receipt_billers():
        for pat in entry.get("body_match", []):
            if re.search(pat, biller, re.I):
                return entry
    return None


# Common business-name prefixes that PSE/ACH prepend but don't identify the actual biller.
_PSE_NOISE = re.compile(r"^(?:PAGO\s+A\s+|PAGO\s+DE\s+|PAGO\s+|RECIBO\s+DE\s+)", re.I)


# ---------- Notion row ops ----------
def page_has_dedup_key(page_id: str, dedup_key: str) -> bool:
    if not dedup_key:
        return False
    cursor = None
    while True:
        url = f"https://api.notion.com/v1/blocks/{page_id}/children?page_size=100"
        if cursor:
            url += f"&start_cursor={cursor}"
        r = notion_call(url, "GET", body=None)
        for b in r.get("results", []):
            if b.get("type") in ("image", "heading_3"):
                rt = b.get(b["type"], {}).get("caption") or b.get(b["type"], {}).get("rich_text") or []
                for t in rt:
                    if t.get("plain_text", "").find(dedup_key) >= 0:
                        return True
        if r.get("has_more") and r.get("next_cursor"):
            cursor = r["next_cursor"]
        else:
            return False


def find_row_by_name(notion_name: str, month: str) -> str | None:
    """Find the page_id of the row matching `notion_name` in `month` (YYYY-MM).

    Uses a calendar-aware last-day-of-month so the query works for short months
    (e.g. 'YYYY-02-31' is invalid; we compute 28/29 instead).
    """
    import calendar
    y, m = month.split("-")
    last_day = calendar.monthrange(int(y), int(m))[1]
    body = {
        "page_size": 5,
        "filter": {
            "and": [
                {"property": "Name", "title": {"equals": notion_name}},
                {"property": "Due Date", "date": {"on_or_after": f"{month}-01"}},
                {"property": "Due Date", "date": {"on_or_before": f"{month}-{last_day:02d}"}},
            ]
        },
    }
    r = notion_call(f"https://api.notion.com/v1/data_sources/{DS}/query", "POST", body).get("results", [])
    return r[0]["id"] if r else None


def get_row(page_id: str) -> dict:
    return notion_call(f"https://api.notion.com/v1/pages/{page_id}", "GET", None)


def patch_row_paid_and_price(page_id: str, price: int, payment_ref: str | None = None, skip_price: bool = False) -> None:
    """Set Paid = Done, update Price (unless skip_price=True), and (if EMCALI) the Electronic Payment Code.

    skip_price: when True, only set Paid + Electronic Payment Code; leave Price alone. Used for
    receipts that are add-ons (Movistar topups) rather than the bill itself.
    """
    props = {"Paid": {"status": {"name": "Done"}}}
    if not skip_price:
        props["Price"] = {"number": price}
    if payment_ref:
        props["Electronic Payment Code"] = {"rich_text": [{"type": "text", "text": {"content": payment_ref}}]}
    notion_call(f"https://api.notion.com/v1/pages/{page_id}", "PATCH", {"properties": props})


# ---------- Render + upload ----------
HTML_TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 32px 24px; background: #f4f5f7;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a; font-size: 18px; line-height: 1.45;
  }}
  .card {{
    background: #ffffff; border-radius: 18px; padding: 28px 24px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
    max-width: 700px; margin: 0 auto;
  }}
  .header {{ display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }}
  .logo {{
    width: 56px; height: 56px; border-radius: 14px; background: {brand_color};
    color: #fff; font-weight: 800; font-size: 20px;
    display: flex; align-items: center; justify-content: center;
    letter-spacing: -0.5px;
  }}
  .title {{ font-size: 22px; font-weight: 700; margin: 0; }}
  .subtitle {{ font-size: 14px; color: #6b7280; margin-top: 2px; }}
  .badge {{
    display: inline-block; padding: 4px 10px; border-radius: 999px;
    background: #ecfdf5; color: #047857; font-size: 13px; font-weight: 600;
    margin-left: auto;
  }}
  .amount {{
    font-size: 44px; font-weight: 800; letter-spacing: -1px;
    margin: 12px 0 6px;
  }}
  .amount-label {{ font-size: 14px; color: #6b7280; margin-bottom: 22px; }}
  hr {{ border: none; border-top: 1px solid #eef0f3; margin: 18px 0; }}
  .row {{ display: flex; justify-content: space-between; padding: 8px 0; gap: 16px; }}
  .row .k {{ color: #6b7280; font-size: 14px; flex: 0 0 auto; }}
  .row .v {{ font-weight: 600; text-align: right; word-break: break-word; }}
  .row .v.mono {{ font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 15px; }}
  .footer {{
    margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;
    line-height: 1.5;
  }}
</style></head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">{brand_short}</div>
      <div>
        <p class="title">{title}</p>
        <p class="subtitle">{fecha}</p>
      </div>
      <span class="badge">PAGADO</span>
    </div>
    <div class="amount">${monto}</div>
    <div class="amount-label">COP · {biller}</div>
    <hr/>
    {rows}
    <div class="footer">
      {tag}<br/>
      Recibo emitido por {sender}
    </div>
  </div>
</body></html>
"""


BRAND = {
    "nu": ("Nu", "#820ad1"),
    "pse": ("PSE", "#0033a0"),
    "aval_pasarela": ("Aval", "#ed1c24"),
    "avalpay": ("Aval", "#ed1c24"),
    "epayco": ("ePayco", "#1c8ceb"),
    "telefonica": ("Tigo", "#003478"),
}


def _opt(pattern, body, default=None):
    """Search a regex; return group(1) or default if no match."""
    m = re.search(pattern, body)
    return m.group(1).strip() if m else default


def _row_html(k, v):
    cls = " mono" if re.match(r"^[\d\-]+$", str(v or "").strip()) else ""
    v = v or "—"
    return f'<div class="row"><span class="k">{k}</span><span class="v{cls}">{v}</span></div>\n'


def render_png(parsed: dict, recipe_name: str, fields: dict, out_path: Path, tag: str = ""):
    from playwright.sync_api import sync_playwright

    brand_key = recipe_name.replace("recipe_", "").replace("_plain_text", "").replace("_html", "").replace("_html_body", "")
    brand_short, brand_color = BRAND.get(brand_key, ("✓", "#10b981"))
    title = "Comprobante de pago"
    if "pse" in recipe_name: title = "PSE - Transacción aprobada"
    if "epayco" in recipe_name: title = "ePayco - Transacción aceptada"
    if "telefonica" in recipe_name: title = "Pago recibido"
    if "aval" in recipe_name: title = "Aval - Pago aprobado"

    rows = []
    for k, v in fields.get("extra", {}).items():
        if v:
            rows.append(_row_html(k.replace("_", " ").title(), v))
    rows.append(_row_html("Destinatario", fields["biller"]))

    html = HTML_TEMPLATE.format(
        brand_short=brand_short,
        brand_color=brand_color,
        title=title,
        fecha=parsed["date"][:16],
        monto=fields["amount_str"],
        biller=fields["biller"],
        rows="".join(rows),
        tag=tag,
        sender=parsed["from"].split("<")[-1].strip(">") or parsed["from"],
    )
    tmp_html = out_path.with_suffix(".html")
    tmp_html.write_text(html, encoding="utf-8")
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 750, "height": 1200}, device_scale_factor=2)
        page = ctx.new_page()
        page.goto("file://" + str(tmp_html))
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(out_path), full_page=True, type="png")
        browser.close()
    return out_path


def upload_png_to_notion(png_path: Path) -> str:
    up = notion_call(
        "https://api.notion.com/v1/file_uploads",
        "POST",
        {"filename": png_path.name, "content_type": "image/png"},
    )
    fid = up["id"]
    boundary = "----Hermes" + uuid.uuid4().hex
    with open(png_path, "rb") as f:
        data = f.read()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{png_path.name}"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    url = f"https://api.notion.com/v1/file_uploads/{fid}/send"
    req = urllib.request.Request(url, method="POST", data=body)
    req.add_header("Authorization", "Bearer " + _notion_key())
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()
    return fid


def append_file_block(page_id: str, file_upload_id: str, caption: str):
    return notion_call(
        f"https://api.notion.com/v1/blocks/{page_id}/children",
        "PATCH",
        {
            "children": [
                {
                    "object": "block",
                    "type": "heading_3",
                    "heading_3": {"rich_text": [{"type": "text", "text": {"content": caption}}]},
                },
                {
                    "object": "block",
                    "type": "image",
                    "image": {
                        "type": "file_upload",
                        "file_upload": {"id": file_upload_id},
                        "caption": [{"type": "text", "text": {"content": caption}}],
                    },
                },
            ]
        },
    )


# ---------- High-level entry point ----------
def process_email(parsed: dict, month: str, png_dir: Path, dry_run: bool = False) -> dict:
    """Process one email payment receipt.

    parsed: dict from parse_eml()
    month: YYYY-MM, used to find the matching Notion row
    dry_run: if True, don't PATCH / upload / attach; just return the detection result
    """
    detected = detect_recipe(parsed)
    if not detected:
        return {
            "matched": False, "error": "no recipe matched the email",
            "subject": parsed.get("subject", ""), "from": parsed.get("from", ""),
        }
    recipe_name = detected["recipe"]
    fields = detected["fields"]

    biller = fields["biller"]
    biller_map_entry = find_biller_in_map(biller)
    if not biller_map_entry:
        # Try once more after stripping common prefixes (e.g. "PAGO EDIFICIO ..." -> "EDIFICIO ...")
        stripped = _PSE_NOISE.sub("", biller)
        if stripped != biller:
            biller_map_entry = find_biller_in_map(stripped)
            if biller_map_entry:
                biller = stripped
    if not biller_map_entry:
        return {
            "matched": False, "error": f"unknown biller: {biller!r}",
            "subject": parsed.get("subject", ""), "from": parsed.get("from", ""),
            "recipe": recipe_name, "fields": fields,
        }
    notion_name = biller_map_entry["notion_name"]

    if dry_run:
        return {
            "matched": True, "recipe": recipe_name, "notion_name": notion_name,
            "fields": fields, "biller": biller, "month": month, "dry_run": True,
            "biller_map_entry": biller_map_entry.get("id"),
        }

    page_id = find_row_by_name(notion_name, month)
    if not page_id:
        # Try previous month (receipt might be paying a late bill from the prior month)
        y, m = month.split("-")
        m_int = int(m)
        prev_y, prev_m = (y, m_int - 1) if m_int > 1 else (str(int(y) - 1), "12")
        prev_month = f"{prev_y}-{int(prev_m):02d}"
        page_id = find_row_by_name(notion_name, prev_month)
        if page_id:
            month = prev_month  # use the row we found

    if not page_id:
        return {
            "matched": False, "error": f"no row for {notion_name!r} in {month} (or prev month)",
            "subject": parsed.get("subject", ""), "from": parsed.get("from", ""),
            "recipe": recipe_name, "fields": fields, "notion_name": notion_name,
        }

    # Idempotency
    if page_has_dedup_key(page_id, fields["dedup_key"]):
        return {
            "matched": True, "recipe": recipe_name, "notion_name": notion_name,
            "page_id": page_id, "month": month, "fields": fields,
            "skipped_duplicate": True, "dedup_key": fields["dedup_key"],
        }

    pre = get_row(page_id)
    was_paid_before = pre["properties"]["Paid"]["status"]["name"] == "Done"
    pre_price = pre["properties"]["Price"]["number"]

    is_emcali = notion_name == "Utilities ⚡️"
    payment_ref = fields.get("extra", {}).get("ref") if is_emcali else None
    skip_price = biller_map_entry.get("skip_price_update", False)
    patch_row_paid_and_price(
        page_id,
        fields["amount"],
        payment_ref=payment_ref,
        skip_price=skip_price,
    )

    png_dir.mkdir(parents=True, exist_ok=True)
    png_path = png_dir / f"receipt_{_hash_dedup(parsed.get('date',''), biller, fields['amount'])}.png"
    render_png(parsed, recipe_name, fields, png_path, tag=f"op {fields['dedup_key'][:8]}")
    file_upload_id = upload_png_to_notion(png_path)
    caption = (
        f"Comprobante — {biller} — ${fields['amount_str']} — {parsed['date'][:16]}"
        f" — op {fields['dedup_key'][:12]}"
    )
    append_file_block(page_id, file_upload_id, caption)

    return {
        "matched": True, "recipe": recipe_name, "notion_name": notion_name,
        "page_id": page_id, "month": month, "fields": fields,
        "was_paid_before": was_paid_before, "now_paid": True,
        "pre_price": pre_price, "png_path": str(png_path),
        "file_upload_id": file_upload_id, "caption": caption,
        "dedup_key": fields["dedup_key"],
    }


# ---------- CLI ----------
def _fetch_eml_from_bridge(message_id: int, folder: str = '"All Mail"') -> bytes:
    cfg = open(os.path.expanduser("~/.config/himalaya/config.toml")).read()
    USERNAME = re.search(r'imap\.sasl\.login\.username\s*=\s*"([^"]+)"', cfg).group(1)
    pw = subprocess.check_output(
        ["security", "find-generic-password", "-a", "me@reobin.dev", "-s", "hermes-proton-bridge", "-w"]
    ).decode().strip()
    cert_path = os.path.expanduser("~/.config/himalaya/proton-bridge-cert.pem")
    tls_context = ssl.create_default_context(cafile=cert_path)
    M = imaplib.IMAP4("127.0.0.1", 1143)
    M.starttls(ssl_context=tls_context)
    M.login(USERNAME, pw)
    M.select(folder)
    typ, data = M.fetch(str(message_id), "(RFC822)")
    M.logout()
    if not data or data[0] is None:
        raise RuntimeError(f"imap fetch returned no data for message {message_id}")
    payload = data[0][1]
    if not isinstance(payload, (bytes, bytearray)):
        raise RuntimeError(f"unexpected fetch payload for message {message_id}: {type(payload).__name__}")
    return bytes(payload)


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--eml")
    src.add_argument("--message-id", type=int)
    ap.add_argument("--mailbox", default='"All Mail"', help="IMAP mailbox for --message-id")
    ap.add_argument("--month", default=None, help="YYYY-MM (default: current)")
    ap.add_argument("--png-dir", default="/tmp/bill-receipts/png")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.eml:
        raw = Path(args.eml).read_bytes()
    else:
        raw = _fetch_eml_from_bridge(args.message_id, args.mailbox)

    parsed = parse_eml(raw)

    if args.month is None:
        from datetime import datetime
        args.month = datetime.utcnow().strftime("%Y-%m")

    result = process_email(parsed, month=args.month, png_dir=Path(args.png_dir), dry_run=args.dry_run)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
