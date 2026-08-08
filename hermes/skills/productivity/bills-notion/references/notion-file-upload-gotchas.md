# Notion API gotchas (file uploads + date filters + GET bodies)

Concrete quirks that any future Notion work hits. These are session-specific detail captured 2026-07-02 while building the receipt-attachment pipeline. The class-level Notion API patterns belong in the `productivity/notion` skill; this file is the bills-specific gotcha list.

## 1. File upload uses a 3-step flow — `upload_url` is not a Bearer-auth URL

The `POST /v1/file_uploads` endpoint returns an `upload_url`, but **that URL rejects Bearer auth**. Misuse produces a 401 with no other clue. The actual upload goes to a separate endpoint with the same Bearer auth.

```python
# Step 1: create the file upload object
up = notion_call("https://api.notion.com/v1/file_uploads", "POST",
                 {"filename": "receipt.png", "content_type": "image/png"})
upload_id = up["id"]
# upload_id is what you reference from blocks; upload_url is a trap.

# Step 2: send the file to the /send endpoint (NOT to upload_url)
boundary = "----" + uuid.uuid4().hex
body = (f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="receipt.png"\r\n'
        f"Content-Type: image/png\r\n\r\n").encode() + png_bytes + f"\r\n--{boundary}--\r\n".encode()
req = urllib.request.Request(
    f"https://api.notion.com/v1/file_uploads/{upload_id}/send",
    method="POST", data=body)
req.add_header("Authorization", "Bearer " + NOTION_KEY)
req.add_header("Notion-Version", "2025-09-03")
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
# ... send ...

# Step 3: reference in a block
notion_call(f"https://api.notion.com/v1/blocks/{page_id}/children", "PATCH", {
    "children": [{
        "object": "block", "type": "image",
        "image": {"type": "file_upload", "file_upload": {"id": upload_id},
                  "caption": [{"type": "text", "text": {"content": "..."}}]},
    }]
})
```

The `boundary` parameter is mandatory. `urllib` doesn't build it for you.

## 2. `GET` requests must NOT include a body — Notion 400s

Notion returns 400 Bad Request if you send a request body with a GET method. `urllib.request` happily attaches an empty body — silent trap. The validation error mentions the four expected keys (`equals`, `before`, `after`, `on_or_before`) but doesn't say "you sent a body".

**Fix**: in any Notion HTTP helper, only set `Content-Type` and only attach a body when `method != "GET"` or `body is not None`.

```python
def notion_call(url, method, body=None):
    h = {"Authorization": "Bearer " + key, "Notion-Version": "2025-09-03"}
    if body is not None or method != "GET":
        h["Content-Type"] = "application/json"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in h.items(): req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())
```

## 3. `on_or_before: "YYYY-MM-31"` is invalid for short months

Notion date filters require real ISO 8601 dates. February 31 doesn't exist; sending it returns 400 with a validation_error listing all four expected keys (`equals`, `before`, `after`, `on_or_before`) — misleading because the real problem is the date itself, not which key you used.

**Fix**: use `calendar.monthrange(year, month)[1]` to compute the last day.

```python
import calendar
last_day = calendar.monthrange(2026, 2)[1]  # -> 28
body = {"filter": {"and": [
    {"property": "Due Date", "date": {"on_or_after": "2026-02-01"}},
    {"property": "Due Date", "date": {"on_or_before": f"2026-02-{last_day:02d}"}},
]}}
```

`on_or_after: "YYYY-MM-01"` is always valid (1st exists in every month) — no need to compute the first day.

## 4. Property rename: `{"OldName": {"name": "NewName"}}` is the right shape

Renaming a property on a data source:

```python
notion_call(f"https://api.notion.com/v1/data_sources/{DS_ID}", "PATCH",
            {"properties": {"Payment Ref": {"name": "Electronic Payment Code"}}})
```

The bare `{"OldName": {"name": "NewName"}}` (without the wrapping `properties` key) silently fails. The wrapping is required. (2026-07-02 — renamed `Payment Ref` to `Electronic Payment Code` to disambiguate from the post-pay transaction id; the rename preserved all existing values.)

## 5. Deleting a property: pass `null`

```python
notion_call(f"https://api.notion.com/v1/data_sources/{DS_ID}", "PATCH",
            {"properties": {"OldName": None}})
```

The property must exist (else 400). Notion treats the `null` as a delete directive. Returns 200 with the property removed.

## 6. Property shapes are not uniform — see `scripts/extract-prop.py`

A helper that does `val = row["properties"][key][ptype]; val.get(sub)` will crash because:

- `Name` (title) is a **list** of rich_text objects
- `Paid` (status) is a **dict** with `{"name": "..."}`
- `Due Date` (date) is a **dict** with `{"start": "..."}` (or `None`)
- `Price` (number) is a **raw int** (or `None`)
- `Electronic Payment Code` (rich_text) is a **list** of rich_text objects (or `[]`)

`scripts/extract-prop.py` is the type-dispatching extractor. Use it.

## 7. Surface HTTPError body for debug

The default `urllib.error.HTTPError` doesn't surface the response body, so a 400 from Notion is just `HTTPError: 400` with no clue. Wrap to include the body:

```python
import urllib.error
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", "replace")[:500]
    raise RuntimeError(f"Notion {method} {url} -> {e.code}: {body}") from e
```

This is what surfaces "body failed validation. Fix one: body.filter.and[2].date.equals should be defined" — actually useful diagnostic.

## 8. `notion_call` helper: when to use `body=None` vs `body={}`

- `body=None` → no body, no Content-Type header. Use for GETs.
- `body={}` → empty JSON object body, with Content-Type. Use for POSTs that have no payload but the API expects a body.

For most Notion POSTs (create page, query data source, PATCH property), pass an actual dict — even an empty `{}` is fine if the API accepts it.
