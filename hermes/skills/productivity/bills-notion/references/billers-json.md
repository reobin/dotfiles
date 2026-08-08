# billers.json — known-biller contract for `email-bills-classify-and-remind`

The cron reads `~/.hermes/config/billers.json` at the top of every tick. Each entry maps a biller (identified by sender domain + subject keyword) to a Notion row (`Name` exact match including the category emoji suffix) and a recipe hint. New entries are added when a bill email arrives that the cron can't classify — the user adds the row + the entry in the same commit.

## Schema

```json
{
  "billers": [
    {
      "id": "<short slug, used in error reports>",
      "name_match": ["<sender-domain or subject substring>", "..."],
      "notion_name": "<exact Name in Notion Bills DB, or null for receipts>",
      "extract": "<recipe hint: emcali-pdf, claro-html, tigo-html, gas-pdf, gdo-pdf, nu-html-body, ...>",
      "notes": "<free-form: bill structure, key field names, account holder, contract number, etc.>"
    }
  ]
}
```

- `name_match` is checked case-insensitively against the From header and Subject. List multiple patterns to be robust to subject-shape variations (e.g. `["facturacionelectronica@gdo.com.co", "gdo.com.co", "GASES DE OCCIDENTE"]`).
- `notion_name` is the **category name with emoji suffix** (e.g. `Gas 🔥`), not the biller brand name. EMCALI is stored as `Utilities ⚡️` because it's the catch-all for electricity + water + aseo + tasa + alumbrado. Same pattern for the rest — see pitfall #17 in the parent skill.
- `extract` is a hint to the cron about which recipe in the cron prompt to follow for parsing the attachment. The actual recipes live inline in the cron prompt; the hint is descriptive only. Examples that have been used: `emcali-pdf`, `claro-html`, `tigo-html`, `gas-pdf`, `gdo-pdf`, `nu-html-body`.

## Adding a new entry

1. **Look at the unknown-biller digest report** — sender domain, subject, amount if extracted, due date if extracted, message id.
2. **In Notion Bills DB**, confirm there is (or create) a row whose `Name` matches the biller. Use the existing emoji convention (🔥 gas, ⚡️ utilities, 🛜 internet, 📱 mobile, 🏡 admin, 🏥 health, etc.).
3. **Add the entry** with `name_match` patterns that uniquely identify the sender (domain substring is the most reliable). `notion_name` = the row's exact `Name`. `extract` = the recipe name. `notes` = one or two sentences capturing the field labels in the PDF/XML — the cron uses these notes to find the right regexes.
4. **Commit** to the hermes config repo. The next cron tick picks it up.

## Currently registered billers (as of 2026-07-10)

| id | notion_name | sender / subject signal | extract | notes |
|---|---|---|---|---|
| `emcali` | `Utilities ⚡️` | `emcali`, `factura digital`, `890399003` | `emcali-pdf` | Cali utility (electricity + water + aseo + tasa + alumbrado). UBL XML + Factura_EmCali_*.pdf. Account: Diana Maria Vargas Castellanos, contract 47041524. No. Pago Electrónico is the 9-digit code on PDF page 1 upper-right and `cbc:AccountingCostCode` in the XML. |
| `nu` | `null` (receipts) | `nu@nu.com.co`, `comprobante de pago de servicio` | `nu-html-body` | Nu Colombia payment receipts. Body IS the receipt (no PDF/XML). Dispatched to `bill_receipt.py` which maps Empresa → Notion row via `receipt_billers.json` (Tigo Móvil → Tigo 📱, Claro Hogar → Claro 🛜, Acueducto Y Energia - Emcali → Utilities ⚡️, etc.). Distinguish from `Pagaste en <merchant>` card purchases — different subject, not matched. |
| `gdo` | `Gas 🔥` | `facturacionelectronica@gdo.com.co`, `gdo.com.co`, `GASES DE OCCIDENTE` | `gdo-pdf` | GASES DE OCCIDENTE S. A. E.S.P. (NIT 800167643) — natural-gas biller for the Cali house. Subject is a tracking-link stub shape: `<NIT>;<RAZON_SOCIAL>;<DOC>;<CODE>;<RAZON_SOCIAL>;`. Body is a stub; the actual bill is in the PDF/XML attachment. Field labels in the PDF have NOT been verified yet — confirm against an actual PDF before relying on them. |

## Inverse pattern: bills in Notion without a `billers.json` entry

The cron only flags a biller as unknown when its email arrives. Several Notion rows (e.g. `Claro 🛜`, `Tigo 📱`, `Health Robin 🏥`, `Prepaid Health`, `Admin 🏡`) have no `billers.json` entry — meaning the next bill email from any of those senders will trigger an unknown-biller digest, the user will have to add the entry, and that one bill will be processed manually instead of automatically.

**Proactive check:** on any "show me my bills" / "what do I owe this month" task, query the Notion data source for the current month's rows, extract the unique `Name` values, and diff against `billers.json`. Surface the missing entries so the user can wire them up before the next bill email lands. See the **billers.json ↔ Notion Bills sync** section in the parent skill for the full rule.
