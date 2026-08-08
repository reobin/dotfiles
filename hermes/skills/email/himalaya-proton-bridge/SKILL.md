---
name: himalaya-proton-bridge
description: "Wire Himalaya CLI to Proton Bridge so one IMAP account reads Proton + all connected foreign inboxes (iCloud, Gmail, etc.), with archive/label/delete support. Use when the user wants email from a single Proton account, the merged Proton inbox, or any Himalaya-on-Proton-Bridge work."
version: 1.1.0
author: hermes
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [email, himalaya, proton, bridge, imap, smtp]

---

# Himalaya + Proton Bridge on macOS

## What this solves

One Himalaya account pointed at Proton Bridge (`127.0.0.1:1143` IMAP, `1025` SMTP) reads **Proton + every foreign account Proton has connected** (iCloud, Gmail, Outlook) through a single IMAP connection. All inboxes are already merged inside Proton — Bridge exposes the merged mailbox over IMAP.

**Send limitation:** Proton Bridge only sends as the Proton address. Replies to iCloud/Gmail messages will go out from Proton, not the original sender. Proton-side constraint, not a config problem.

## Install

```bash
# Add to ~/dotfiles/brew/Brewfile (uncommitted — user commits)
brew "himalaya"
cask "proton-mail-bridge"
brew bundle install --file ~/dotfiles/brew/Brewfile
```

## One-time user setup at the PC

User does this themselves (Bridge has a UI, requires Proton login + 2FA):

1. Open **Proton Mail Bridge.app** from `/Applications`. It lives in the menu bar.
2. **Add account** → sign in to Proton (email + password + 2FA).
3. Click **"Other"** when asked which mail client to configure (don't pick Apple Mail/Outlook — they launch their own wizards).
4. Bridge shows a screen with:
   - IMAP host `127.0.0.1:1143`, SMTP host `127.0.0.1:1025`
   - A generated **username** (looks like `me@proton.dev`)
   - A generated **password** (random `Word-Word-Word-Word` format)
5. User pastes username + password into chat. Password is per-app, not their real Proton password.

**Bridge must be running for Himalaya to work.** It autostarts on login but is a menu bar app — don't quit it.

## Config (do this, no user input needed)

Store the password in macOS Keychain:

```bash
security add-generic-password \
  -a "me@reobin.dev" \
  -s "hermes-proton-bridge" \
  -w "$PASSWORD" \
  -U
```

Write `~/.config/himalaya/config.toml`:

```toml
[accounts.proton]
email = "me@reobin.dev"
display-name = "reobin"
default = true

imap.server = "imap://127.0.0.1:1143"
imap.starttls = true
imap.sasl.login.username = "me@reobin.dev"
imap.sasl.login.password.command = "security find-generic-password -a 'me@reobin.dev' -s 'hermes-proton-bridge' -w"

smtp.server = "smtp://127.0.0.1:1025"
smtp.starttls = true
smtp.sasl.login.username = "me@reobin.dev"
smtp.sasl.login.password.command = "security find-generic-password -a 'me@reobin.dev' -s 'hermes-proton-bridge' -w"
```

Verify:

```bash
himalaya account list                    # should show proton as default
himalaya folder list                     # should list All Mail, INBOX, Labels/*, Sent, Drafts
himalaya envelope list --page-size 3     # should return real envelopes
```

## Operations

| Op | Command | Result |
|---|---|---|
| List INBOX | `himalaya envelope list --mailbox INBOX --page-size N` | Most recent N messages in INBOX |
| List other folder | `himalaya envelope list --mailbox "<name>"` | Any folder by exact name (e.g. `Archive`, `Sent`, `Labels/rg1530`) |
| Read | `himalaya message read <ID>` | Plain text body |
| Archive | `himalaya message move --from INBOX --to Archive <ID>` | Message leaves INBOX, lands in `Archive` |
| Label | `himalaya message move --from INBOX --to "Labels/<name>" <ID>` | Adds label, removes from INBOX |
| Trash | `himalaya message delete <ID>` | Moves to `Trash` |
| Send | `cat <<EOF \| himalaya template send` | See `email/himalaya` skill for full pattern |
| Move to All Mail | `himalaya message move --from INBOX --to "All Mail" <ID>` | **Fails.** See Pitfalls. |

Himalaya 2.0 uses `--from` and `--to` mailbox options for moves.

## Pitfalls

### 1. `encryption.type = "none"` is REQUIRED

**Do not** use `start-tls` or `tls` against Bridge. Bridge handles encryption to Proton's servers internally; the local socket is plaintext loopback.

Failure modes:
- `start-tls` → rustls rejects Bridge's self-signed cert with `invalid peer certificate: Other(OtherError("certificate is not standards compliant: -67901"))` on macOS, or `CaUsedAsEndEntity` on Linux (Bridge serves a CA cert with `CA:TRUE` as its end-entity cert — see himalaya issue #633).
- `tls` (implicit) → Bridge isn't serving TLS on 1143, the plaintext port is the only one that works.

The Bridge UI labels the security as "STARTTLS" but that's misleading. The official Himalaya README confirms `encryption.type = "none"` for Proton Bridge.

### 2. "All Mail" is virtual, not a real move target

Proton's `All Mail` is an aggregated view of every message. It's exposed as an IMAP folder for *reading* but **cannot be a move destination** — Bridge rejects with `operation not allowed`. Don't try to move things to "All Mail"; use `Archive` or a `Labels/*` folder instead.

This was the source of a real bug: I once concluded "Himalaya + Bridge can't archive" after a `move` to `All Mail` failed. The correct archive target is the `Archive` folder, not `All Mail`. The right test is: `himalaya message move --from INBOX --to Archive <ID>`, which works.

### 3. The codec warnings are NOT always harmless

Himalaya's IMAP codec logs `Rectified faulty continuation request` / `Rectified missing 'text'` on most Bridge interactions. For **simple** messages (Bills cron: EMCALI, Tigo, SURA) the body is delivered correctly despite the warning. **For HTML-only / MIME-nested messages (newsletter digests, marketing email), the warning is followed by an empty body** — `himalaya message read <id>` returns nothing. The exit code is 0, the warning is the only signal, and the caller can't tell apart "this email has no body" from "himalaya failed to parse it". This was the real source of an apparent "himalaya is broken on bytes.dev" — it isn't, it just can't render those particular messages.

**Quick diagnostic — is the body really empty, or did himalaya choke?**

```bash
# Compare himalaya (expected: empty + codec warning) vs raw imaplib (expected: real body)
himalaya message read <id>
python3 ~/.hermes/skills/email/himalaya-proton-bridge/scripts/newsletter_dryrun.py \
  --mailbox "All Mail" --query "(ENVELOPE <id>)" --limit 1
```

If imaplib returns a body and himalaya doesn't, it's the codec bug, not an empty email. Don't waste turns "fixing" the email — fix the read path.

**Fix: fall back to raw `imaplib` + `email` stdlib.** Himalaya v1.x is a thin wrapper over the same protocol and a raw fetch + `email.message_from_bytes` is faster to write than to keep poking at himalaya for these senders. See `references/html-only-body-fallback.md` for a copy-pasteable script that:

- Reads the Bridge password from macOS Keychain via `security find-generic-password` (matches `auth.cmd` in the himalaya config).
- Connects to `127.0.0.1:1143`, lists a folder, fetches full RFC822 for each message ID.
- Walks `text/plain` then `text/html` parts; extracts `<a href>` + anchor text via a tiny `HTMLParser` subclass.
- Quotes folder names with spaces (`m.select(chr(34) + "All Mail" + chr(34))`) — unquoted names raise `BAD [Error offset=17]: expected CR` from Bridge.
- **Tracks an explicit `_in_a` flag in the `LinkExtractor`** so anchor text doesn't leak across sibling `<a>` blocks. The naive `handle_data`-only version captures the next paragraph's text into the previous link's anchor — a real bug seen 2026-07-02 on cassidoo where the "Wiggly/Wavy Input Range Slider" link came back as `"Wiggly/Wavy Input Range Slider\r\n\r\nSomething that interested me this we..."`. The flag-based `LinkExtractor` in the reference and `scripts/newsletter_dryrun.py` handles this correctly. **If you write your own HTMLParser, use the flag-based approach.** The default `handle_data` accumulation without reset on `</a>` is wrong for nested/sibling `<a>` structures (common in hand-edited newsletter HTML).

Use himalaya for envelope listing + moves (it's fine for those — the codec bug is in body rendering). Drop to imaplib only for `message read` against senders that have been confirmed to trigger the empty-body symptom.

### 4. Moves on foreign-account (iCloud/Gmail) mail DO NOT remove the source copy from INBOX

This is the real gotcha, not the "stale ack" pattern. For messages that originated from a **connected foreign account** (Proton has fetched them from iCloud/Gmail/Outlook), `himalaya message move` will:

- **Copy** the message into the target folder (`Labels/bills`, `Archive`, etc.) — you see it there.
- **Fail to remove the source copy from INBOX** — even after 5+ retries. The source is not a real Proton message; it's a Proton-managed copy of a foreign-account message, and Bridge has no IMAP authority to delete it.

The `move` command returns "successfully moved" every time, which makes it look like a transient issue. It is not — it's a permanent structural limit. **You will end up with the message in BOTH the target folder and INBOX.** No retry pattern fixes this.

**Real options for these messages:**
1. **Tag them in Proton Mail UI** — the Proton native app can apply labels to foreign-account mail, and the label is then visible via Bridge. This is the right path for "I just want this labeled."
2. **Set up real IMAP accounts for iCloud/Gmail directly** — moves on actual iCloud/Gmail IMAP servers work because the source IS a native message there. Re-introduces the multi-account setup.
3. **Set a Proton Mail rule** to auto-label incoming messages matching bill patterns. Most robust for ongoing work.
4. **Accept the duplication and treat INBOX as the unified "unread/new" view.** Use folder listings (`Labels/bills`) as the per-tag archive.

Verify by listing BOTH folders after a move:

```bash
  himalaya envelope list --mailbox INBOX --page-size 50
  himalaya envelope list --mailbox "Labels/bills" --page-size 50
# If a message appears in both, it's a foreign-account copy — see above.
```

Proton-native messages (sent to your Proton address, not fetched from a connected account) move cleanly: source copy disappears, target copy appears, no duplication.

### 5. Stale-ack on Proton-native moves is a real but smaller issue

For Proton-native messages, `message move` does work — but Bridge can return "successfully moved" before the server-side state is fully updated. Symptom: you move, see success, re-list the source, the message is still there with a new ID. Retry pattern for these:

```bash
move_with_retry() {
  local target="$1" folder="$2" pattern="$3"
  for attempt in 1 2 3; do
    local id
    id=$(himalaya envelope list --mailbox "$folder" --page-size 50 \
         | awk -F'|' -v p="$pattern" 'BEGIN{IGNORECASE=1} $0 ~ p {print $2; exit}' \
         | tr -d ' ')
    [ -z "$id" ] && return 0
    himalaya message move --from "$folder" --to "$target" "$id" >/dev/null
    sleep 1
  done
}
```

If retries don't clear the source, it's Pitfall #4 (foreign-account copy), not a transient.

### 6. `Folders/<name>` vs `Labels/<name>` prefix is set by Proton, not the user

When you create a folder/label in Proton Mail, Bridge exposes it under whichever prefix Proton decides. There is no user-controlled choice between `Folders/` and `Labels/`:

- **User-created folders** (drag-to-create in Proton Mail sidebar) → `Folders/<name>`.
- **User-created labels** (Labels panel, "Create label") → `Labels/<name>`.
- **Auto-generated labels for connected accounts** (e.g. `Labels/rg1530`, `Labels/POAP`, `Labels/iCloud`) → always `Labels/<name>`.

If you delete a `Folders/bills` and recreate as a label, Proton assigns `Labels/bills`. **Any messages that were in the deleted `Folders/bills` are returned to INBOX, not deleted.** (Don't confuse this with "messages were lost" — they're not.) The reverse (delete a label, recreate as folder) is similar. Check with `himalaya folder list` before scripting.

**Move behavior on foreign-account mail depends on destination:**
- `move ... "Archive" <ID>` → message leaves source folder. Works reliably for both Proton-native and connected-account (iCloud/Gmail) mail.
- `move ... "Labels/<name>" <ID>` → for connected-account mail, Bridge copies to the label folder but **leaves the original in the source folder**. The message ends up in *both* places. This is the intended Proton semantic: labels are additive tags, not folders. For pure tagging of connected-account mail, the message will appear in `Labels/<name>` and stay in INBOX (or wherever it was). Use Proton Mail UI for "tag only" workflows; use this move for "tag and keep" workflows where the duplication is fine.

### 7. Foreign account sync lag

iCloud/Gmail messages inside Proton's "All Mail" arrive on Proton's fetch schedule, not real-time. For Hermes' use (digests, on-demand reads) this is fine. For instant iCloud/Gmail monitoring, those accounts need their own IMAP.

### 8. Bridge must be running

`lsof -nP -iTCP:1143 -sTCP:LISTEN` should always show the `bridge` process. If it doesn't, Bridge got quit or crashed — relaunch from `/Applications`.

### 9. Don't store the password in the config

`auth.raw = "..."` is a Himalaya-supported shortcut but puts the password in plaintext on disk. `auth.cmd` + macOS Keychain is the standard pattern (and what this skill uses). On Linux: `pass show proton`.

## Connected-inbox layout

Proton creates a `Labels/<connected-address>` folder for each foreign account it fetches. So if Proton has iCloud and Gmail connected, you'll see `Labels/iCloud` and `Labels/reobin.dev` in `himalaya folder list`. Foreign mail is also copied to `All Mail` (Proton's unified archive).

## Verifying the install is healthy

```bash
lsof -nP -iTCP:1143 -sTCP:LISTEN    # bridge process listening on IMAP
lsof -nP -iTCP:1025 -sTCP:LISTEN    # bridge process listening on SMTP
himalaya account list               # proton as default
himalaya envelope list --page-size 3  # returns real messages without errors
```

If all three pass, the pipeline is end-to-end working.

## See also

- `references/extracting-from-attachments.md` — workflow for pulling data out of PDF, ZIP+XML, and image attachments when the email body is just a "see attached" notification.
- `references/inbox-automation-cron.md` — pattern for cronifying inbox processing: LLM decides per-message, dispatch to Reminder / label / archive. Includes the `email-bills` cron as a working example.
- `references/html-only-body-fallback.md` — raw `imaplib` script + diagnosis recipe for when `himalaya message read` silently returns empty bodies on HTML-only senders (newsletter digests, marketing mail). Use this as the body-fetch path for the newsletter cron; keep himalaya for moves.
- `references/colombian-payment-rails.md` — sender-agnostic receipt detector for Colombian payment gateways (Nu comprobante, PSE, Aval, ePayco, Telefónica). Multi-recipe pattern with the last-separator-wins amount heuristic, HTML entity decoding, and dedup key extraction. Use for the bills cron receipt path.
- `scripts/newsletter_dryrun.py` — end-to-end extract + dedup dry-run for the newsletter cron. Run against a real archived email to verify the curator's input.

## Inbox automation cron pattern

When the user wants the agent to **process incoming mail automatically** (read, decide, dispatch to side effects like Notion updates, labels, archives), the pattern that works is:

1. **Cron job at a fixed daily cadence** (or whatever cadence fits the workload) using the `hermes-cron-jobs` skill. Pin `deliver` to a specific Discord channel ID — never `origin`, never bare `discord` (thread-routing footgun).
2. **First step: verify Bridge is alive.** `lsof -nP -iTCP:1143 -sTCP:LISTEN`. If empty, emit `[SILENT]` and stop. Cron jobs do not start user apps.
3. **Read INBOX only.** Never enumerate `Archive`, `All Mail`, `Sent`, etc. The cron is a "new mail" pipeline, not a search engine.
4. **Body reads go through raw imaplib, not himalaya.** The himalaya v1.x codec bug silently returns empty bodies on HTML-only / MIME-nested senders (newsletter digests, marketing email). Use the script at `references/html-only-body-fallback.md` or the dry-run harness at `scripts/newsletter_dryrun.py` — both work end-to-end and the dry-run is a one-command verification of the read path. Keep himalaya for envelope listing and moves.
5. **LLM decides per message.** For each INBOX message, fetch body + (optionally) attachments, hand the combined text to the model's judgment, get back a structured decision (`{is_bill, matched, biller_id, ...}` or `{is_bill: false, reason}`). Don't regex — the variety of billing email formats (Colombian DIAN UBL XML, US plain text, AWS PDFs) defeats any hand-tuned rule.
6. **Dispatch only on confirmed positive.** If `is_bill: true AND matched: true` AND the side effect (e.g. Notion PATCH) succeeded, then label + archive. If the side effect failed, leave the message in INBOX so the next tick retries.
7. **Unknown billers get a digest report.** If `is_bill: true AND matched: false` (the email looks like a bill but the biller is not in the contract file), post a one-line report to the digest channel listing sender + subject + any extracted amount/due date + message id, then archive. The report is what tells the user "we need a new entry in the biller map for this sender". Never invent a row on the fly.
8. **Report shape:** locked-in `**{emoji} {job-name}**` header + bullets, no date, no count summary. If nothing to do, emit `[SILENT]` and skip Discord delivery. Match the format used by other crons in `jobs.template.json`.

### Two worked examples

Both go to `#roboin-digest` and both use the LLM-decides-then-dispatches shape. Bills run at 9:00; newsletters run at 9:15 so both jobs are not racing the same INBOX at the same minute. Different surface, same spine.

**`email-bills-classify-and-remind` (`ebills2026a01`)** — bills → Notion Bills DB.
- Source: Proton INBOX. Body read: himalaya (simple senders, codec bug doesn't bite).
- Curation spec: `~/.hermes/config/billers.json` (config file, not user memory).
- Decision: matched / unknown / not-a-bill.
- Side effect: PATCH Notion row (Price, Electronic Payment Code, Due Date), then `Labels/bills` + `Archive`.
- Archive policy: leave in INBOX on side-effect failure (retry on next tick).
- Reference: `bills-notion` skill + `references/llm-decides-then-dispatches.md` in `hermes-cron-jobs`.

**`email-newsletters-to-reading-list` (`d9f385e1bc04`)** — newsletters → Notion reading list.
- Source: Proton INBOX. Body read: raw imaplib + the `LinkExtractor` (HTML-only senders, codec bug bites).
- Curation spec: `~/.hermes/memories/user.md` + `~/.hermes/config/reader-feedback.json` (prose profile, not config file).
- Decision: add / skip / maybe (per-link, not per-email). 3-by-default cap with 4th-when-must-not-miss.
- Side effect: POST a new page in the reading-list data source for each `add` decision, then `Archive`.
- Archive policy: only archive messages that pass the newsletter gate; gated newsletters archive regardless of add count. No-gate messages stay in INBOX.
- Feedback loop: `**🤔 maybe?**` section in the report → user replies `yes/no: <topic>` → next interactive session promotes the answer to user memory.
- Reference: this skill's `references/inbox-automation-cron.md` §"Newsletter → Reading List" + the `reading-list` skill's "Cron pipeline" section.

**Choose the right shape for the curation spec:**
- **Config file** (`billers.json`-style) — when the spec is a closed set of well-defined entries (one row per biller, with `name_match` + canonical name + extract recipe). Adding a new entry = editing JSON, no prompt change.
- **Prose profile in user memory** — when the spec is open-ended and texture-dependent (what does this user want to read, what would they find interesting, what counts as "must-not-miss"). The LLM is the curator; the spec evolves through `yes/no` replies to `maybe` items. No JSON to maintain.

Mixing them in one cron is a smell. The newsletter cron's `~/.hermes/config/newsletters.json` is **extraction-only** (denylist sender patterns, social-share hosts, convertkit unwrap hosts) — never the curation policy.

The reference file has complete worked examples for both crons (full prompts, model decision structures, edge cases, dry-run output). For the bills pipeline specifically, see also `~/.hermes/config/billers.json` — the biller→Notion-row contract that the cron reads on every tick. The `bills-notion` skill documents the Notion schema and the email pipeline it implements. For the newsletter pipeline, see also the `reading-list` skill's "Cron pipeline" section.
