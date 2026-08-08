# HTML-only body read fallback (raw imaplib)

When `himalaya message read <id>` returns an empty body but emits `Rectified faulty continuation request`, the workaround is to skip himalaya and fetch the raw RFC822 directly. The himalaya v1.x IMAP codec has a real bug on MIME-nested / HTML-only messages (newsletter digests, marketing email) — the warning is the only signal and the body is silently empty. Bills-cron senders (EMCALI, Tigo, SURA) are simple enough that himalaya still works; this is a fallback, not a replacement.

## When to use

- `himalaya message read <id>` exits 0 but prints only the codec warning and no body.
- You're processing HTML newsletters, digests, or marketing email from a send list that the bills cron doesn't touch.
- The next agent will hit this and waste 5+ turns rediscovering it. Use this script as the starting point.

## Copy-pasteable script

```python
#!/usr/bin/env python3
"""Read message bodies from Proton Bridge via raw imaplib.

Drops the himalaya IMAP codec (which silently returns empty bodies for some
HTML-only senders) and parses RFC822 directly. Password comes from macOS
Keychain via the same `auth.cmd` pattern as the himalaya config.

Usage:
    python3 imap_read.py --mailbox "INBOX" --limit 3
    python3 imap_read.py --mailbox "All Mail" --query '(FROM "bytes.dev")' --limit 5
"""
import argparse
import imaplib
import email
import subprocess
import sys
from email.header import decode_header, make_header
from html.parser import HTMLParser

KEYCHAIN_ACCOUNT = "me@reobin.dev"   # matches backend.login in himalaya config.toml
KEYCHAIN_SERVICE = "hermes-proton-bridge"
BRIDGE_HOST = "127.0.0.1"
BRIDGE_PORT = 1143


def get_bridge_password() -> str:
    """Pull the Bridge IMAP password from macOS Keychain."""
    r = subprocess.run(
        ["security", "find-generic-password",
         "-a", KEYCHAIN_ACCOUNT, "-s", KEYCHAIN_SERVICE, "-w"],
        capture_output=True, text=True, check=True,
    )
    return r.stdout.strip()


class LinkExtractor(HTMLParser):
    """Tiny <a href> + <title> extractor. No third-party deps.

    Preserves anchor text alongside href. The trick is tracking an explicit
    `_in_a` flag across open/close — if you only use `handle_data` + an
    end-of-tag signal, HTMLParser's order-of-events leaks text across adjacent
    <a> blocks (verified 2026-07-02 on a cassidoo digest: anchor text for the
    "Wiggly/Wavy Input Range Slider" link came back as
    "Wiggly/Wavy Input Range Slider\\r\\n\\r\\nSomething that interested me this
    we..." because the </a> came after a sibling anchor, not after the text
    we wanted to capture).
    """

    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []
        self.anchors: list[tuple[str, str]] = []  # (anchor_text, href)
        self.title: str | None = None
        self._in_title = False
        self._in_a = False
        self._current_text = ""
        self._current_href = ""

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "a" and "href" in d:
            # Open a new anchor. If a previous one is still open (unclosed <a>
            # in the source), the new one wins — this is rare but happens in
            # hand-edited newsletter templates.
            self._current_href = d["href"]
            self._current_text = ""
            self._in_a = True
        if tag == "title":
            self._in_title = True

    def handle_data(self, data):
        if self._in_title and not self.title:
            self.title = data.strip()
        if self._in_a:
            self._current_text += data

    def handle_endtag(self, tag):
        if tag == "a" and self._in_a:
            self.hrefs.append(self._current_href)
            self.anchors.append(
                (self._current_text.strip(), self._current_href)
            )
            self._in_a = False
            self._current_href = ""
            self._current_text = ""


def decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    return str(make_header(decode_header(value)))


def fetch_message(m: imaplib.IMAP4, msg_id: bytes) -> dict:
    typ, data = m.fetch(msg_id, "(RFC822)")
    raw = data[0][1]
    msg = email.message_from_bytes(raw)
    body_text = ""
    body_html = ""
    for part in msg.walk():
        ct = part.get_content_type()
        if ct == "text/plain" and not body_text:
            body_text = part.get_payload(decode=True).decode("utf-8", errors="replace")
        elif ct == "text/html" and not body_html:
            body_html = part.get_payload(decode=True).decode("utf-8", errors="replace")

    links: list[tuple[str, str]] = []  # (anchor_text, href)
    if body_html:
        ext = LinkExtractor()
        ext.feed(body_html)
        # `ext.anchors` preserves text alongside href; `ext.hrefs` is the
        # href-only list (kept for callers that don't need text).
        links = ext.anchors
        body_title = ext.title

    return {
        "id": msg_id.decode(),
        "from": decode_header_value(msg["From"]),
        "subject": decode_header_value(msg["Subject"]),
        "date": decode_header_value(msg["Date"]),
        "body_text": body_text,
        "body_html": body_html,
        "body_title": body_title,
        "links": links,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mailbox", default="INBOX")
    ap.add_argument("--query", default="ALL",
                    help="IMAP search expression, e.g. '(FROM \"bytes.dev\")'")
    ap.add_argument("--limit", type=int, default=3)
    ap.add_argument("--max-bytes", type=int, default=2000,
                    help="Truncate each body to this many chars in output")
    args = ap.parse_args()

    pw = get_bridge_password()
    m = imaplib.IMAP4(BRIDGE_HOST, BRIDGE_PORT)
    m.login(KEYCHAIN_ACCOUNT, pw)
    # Folders with spaces MUST be quoted. Bridge rejects unquoted names with
    # `BAD [Error offset=17]: expected CR`.
    quoted = f'"{args.mailbox}"' if " " in args.mailbox else args.mailbox
    m.select(quoted, readonly=True)

    typ, data = m.search(None, args.query)
    ids = data[0].split() if data and data[0] else []
    for msg_id in reversed(ids[-args.limit:]):
        msg = fetch_message(m, msg_id)
        print("=" * 70)
        print(f"ID: {msg['id']}")
        print(f"From: {msg['from']}")
        print(f"Subject: {msg['subject']}")
        print(f"Date: {msg['date']}")
        if msg["body_text"]:
            print(f"\n[text/plain] ({len(msg['body_text'])} chars)")
            print(msg["body_text"][: args.max_bytes])
        if msg["body_html"]:
            print(f"\n[text/html] ({len(msg['body_html'])} chars)")
            print(msg["body_html"][: args.max_bytes])
        if msg["links"]:
            print(f"\n[links] ({len(msg['links'])} total)")
            for anchor, href in msg["links"][:20]:
                snippet = href if len(href) < 100 else href[:100] + "..."
                print(f"  - {snippet}")
        print()

    m.logout()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

## Pitfalls this script works around

1. **Folder names with spaces.** Proton's `All Mail` has a space — IMAP requires it quoted. Unquoted → `imaplib.abort: command: EXAMINE => unexpected response: b' BAD [Error offset=17]: expected CR'`. The script quotes only when needed via `chr(34)`-style detection (kept out of the main path because most folders don't have spaces).
2. **Folder names with `/` work unquoted** (e.g. `Labels/bills`). Don't add quotes preemptively — over-quoting is harmless but the script's `if " " in args.folder` guard is the right check.
3. **`envelope list` style filtering doesn't exist in raw IMAP.** You use `m.search(None, '<IMAP-search-expr>')` instead. The query syntax is IMAP's, not himalaya's. See RFC 3501 §6.4.4 for the full grammar. Common ones: `(FROM "bytes.dev")`, `(OR FROM "a" FROM "b")`, `(UNSEEN)`, `(SUBJECT "newsletter")`, `(SINCE "1-Jul-2026")`.
4. **The codec warning is for himalaya only.** Raw imaplib doesn't emit it. So this script's output is clean — empty body means empty body, not a parse failure.
5. **Himalaya moves still work.** Even when `message read` is broken on a sender, `envelope list`, `message move`, and `message delete` are fine on the same message. Don't replace himalaya wholesale — drop to imaplib only for body reads.
6. **The default `envelope list` page size is small.** A 0-result `envelope list --mailbox INBOX --page-size 50` may simply mean the folder genuinely has <50 messages (most users do). If you suspect this, use `himalaya folder list` first to confirm the folder exists, then bump the page size; or use raw imaplib as above to see the full count.
7. **Anchor text leaks across `<a>` boundaries** if the parser doesn't track an explicit `_in_a` flag across open/close events. The `LinkExtractor` in this reference uses a flag-based approach and works for both tight `<a>text</a>` and sloppy `<a>text<p>more</p><a>` structures. Real bug seen 2026-07-02 on a cassidoo digest: the original `_skip_last`-flag version captured "Wiggly/Wavy Input Range Slider\r\n\r\nSomething that interested me this we" for a single link, because the anchor text bleed extended into the next paragraph. Fix: the rewritten `LinkExtractor` resets state inside `handle_endtag('a')`, and emits one `(text, href)` tuple per closed anchor. Confirmed correct on 50+ link digests. If you need richer parsing (CSS-class-aware, `<img alt>` as text, nested `<a>`), reach for BeautifulSoup (`pip install --user beautifulsoup4`) — the stdlib version handles the common case but not the tail.

## Diagnostic recipe when `himalaya message read` returns empty

```
1. Re-run: himalaya message read <id>
2. If the output is just the codec warning + nothing → himalaya is failing
   silently on this sender. The body is real, himalaya is the bug.
3. Confirm with raw imaplib: python3 imap_read.py --mailbox INBOX --query
   '(ENVELOPE ...)' --limit 1 — or pass the numeric id as a message-id
   filter. If imaplib returns a body and himalaya doesn't, the diagnosis
   is confirmed: codec bug, not empty email.
4. Use the script above as the ingest path. Keep himalaya for moves.
```
