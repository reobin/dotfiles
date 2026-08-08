# Colombian payment-rail email parsing (sender-agnostic receipt detector)

Concrete parsing recipes for the Colombian payment-gateway ecosystem. Captured 2026-07-02 while building the bills cron receipt path. Lives under `himalaya-proton-bridge` because the read path is email, but the biller semantics belong with bills (see `productivity/bills-notion`).

The general pattern: a "you paid X" email arrives from one of several Colombian gateways (Nu Colombia, PSE/ACH, Aval Pasarela, AvalPay Center, ePayco, Telefónica). Each gateway has its own body format. A sender-agnostic detector runs all recipes in priority order and falls back to the LLM-decides path on anything it can't classify.

## The 5 recipes (priority order)

```python
RECIPES = [
    recipe_nu_html_body,        # Nu Colombia comprobante
    recipe_pse_plain_text,      # PSE / ACH Colombia
    recipe_aval_plain_text,     # Aval Pasarela + AvalPay Center
    recipe_epayco_html,         # ePayco
    recipe_telefonica_plain_text,  # Telefónica Colombia direct
]
```

Each recipe returns `None` if it doesn't match the email. The first non-None wins. Order matters because some patterns overlap (e.g. an Aval Pasarela email mentions "PSE" in the body — the PSE recipe would also match on that substring, so PSE must come after Aval or use stricter filtering).

## Recipe: Nu Colombia comprobante

- **Sender**: `nu@nu.com.co`
- **Subject**: `Tu comprobante de pago de servicio.`
- **Body signals**: contains `Empresa a la cual se realizará el pago:`, `Monto: $X.XXX,XX`, `Código de operación: <uuid>`

**Distinguish from Nu card purchases**: Nu also sends `Pagaste en <merchant> con Cuenta Nu` for card purchases. These are NOT bills. Match specifically on the comprobante subject, not on Nu as a sender.

**Monto parsing**: Colombian format `53.900,00` (period=thousands, comma=decimal). Take only the integer part — `53.900,00 → 53900`. Do NOT multiply by 100.

**Dedup key**: `Código de operación` is a UUID. Use it directly.

**Reference for Notion**: `Número de cuenta o referencia de pago` (Claro), `Número de pago electrónico` (EMCALI), or `Número de teléfono` (Tigo). Map to `Electronic Payment Code` only for EMCALI.

## Recipe: PSE / ACH Colombia

- **Sender**: `serviciopse@achcolombia.com.co`
- **Subject**: `PSE - Transacción Aprobada ✅ CUS <digits>`
- **Body signals**: `Valor: $ X.XXX.XXX,XX`, `Empresa: <processor>`, `Descripción: <real biller>`, `CUS: <digits>`

**Critical**: PSE's `Empresa` field is the **payment processor** (GOU Payments, ACH operador), not the actual biller. The real biller is in `Descripción` (e.g. "PAGO EDIFICIO PARQUE KRABI CRA 77 13A1 38 CALI VALLE"). **Prefer Descripción over Empresa.**

**Monto parsing**: PSE can use either Colombian (`1.005.000,00`) or US (`1,005,000.00`) format depending on the bank. Use the last-separator-wins heuristic.

**Dedup key**: `CUS` field. Same CUS appears in 3 confirmation emails for the same payment (PSE + Aval Pasarela + AvalPay Center), so dedup works across all 3.

**Same transaction, 3 confirmations**: PSE generates emails from `achcolombia.com.co`, `pasarelapagosaval.com`, and `avalpaycenter.com.co` for the same payment. The `CUS` / `ID Transacción` is the same. The dispatcher attaches only the first; the others dedup-skip. Expected and good.

## Recipe: Aval Pasarela + AvalPay Center

- **Sender**: `info@pasarelapagosaval.com` (Pasarela), `noreply@avalpaycenter.com.co` (AvalPay)
- **Subject**: `Pasarela de Pagos - APROBADA` (Pasarela), `AvalPay Center: Comprobante de pago <biller>` (AvalPay)
- **Body signals**:
  - Pasarela (table-style HTML): `Empresa \n <biller>`, `Valor de transacción \n $X,XXX,XXX.XX`, `ID Transacción \n <digits>`. The HTML uses `<td>`-like layout where label is on one line and value on the next. Regex must allow `label\s*\n\s*value`.
  - AvalPay (inline sentence): `transacción con ID número <digits> del servicio <biller> , por valor de $ X.XXX.XXX , realizada en el sitio https://www.avalpaycenter.com`. Use regex `del servicio\s+([^,]+?)(?:\s*,|\s+por valor)` to extract the biller (stops at the first comma or "por valor").

**Monto parsing**: Aval Pasarela uses US format (`1,005,000.00`). AvalPay uses Colombian format (`1.005.000`).

**Dedup key**: `ID Transacción` from either sender. Same transaction id as the PSE receipt.

## Recipe: ePayco

- **Sender**: `noreply@epayco.com`
- **Subject**: `Transacción #<digits> ACEPTADA en ePayco`
- **Body signals**: `Ha realizado una transacción en <EMPRESA>.`, `Total $X,XXX.XX`, `Referencia ePayco <uuid>`

**Distinguish from merchant purchases**: ePayco is also used for non-bill purchases (Cinemark, Buscalibre, etc.). The `transacción en <EMPRESA>` line gives the merchant. If the merchant is a biller (COLOMBIA TELECOMUNICACIONES, etc.), treat as a bill receipt. If it's a retailer (CINEMARK, etc.), skip — not a bill.

**Dedup key**: `Referencia ePayco` UUID.

**Medio de pago** field tells you the rail (Daviplata, PSE AVANZA, etc.). Useful for debugging but not for matching.

## Recipe: Telefónica Colombia direct

- **Sender**: `noreply@telefonica.com.co` (or similar)
- **Subject**: `Hemos recibido tu pago`
- **Body signals**: `Estimado usuario, su pago por $ X.XXX del DD/MM/YYYY se aplico correctamente a la cuenta <digits>`

**Tiny body**: no structured fields. The amount, date, and account are inline in a single sentence. Parse with: `pago por\s*\$?\s*([\d\.,]+)`, `cuenta\s+([\d]+)`.

**Dedup key**: hash of `(date, account, amount)` — no UUID available.

## Amount parsing: the last-separator-wins heuristic

```python
def _amount_from_str(s: str) -> int | None:
    """Parse a money string to integer COP. Handles both Colombian and US formats.
    Heuristic: the LAST separator wins. If followed by exactly 2 digits, it's
    the decimal (drop everything after). Otherwise it's a thousands separator.
    """
    s = s.strip()
    last_period = s.rfind(".")
    last_comma = s.rfind(",")
    sep = max(last_period, last_comma)
    if sep == -1:
        digits = re.sub(r"[^\d]", "", s)
        return int(digits) if digits else None
    after = s[sep + 1:]
    if len(after) == 2 and after.isdigit():
        integer_part = s[:sep]  # decimal — drop everything from sep
    else:
        integer_part = s[:sep] + s[sep + 1:]  # thousands — drop the sep
    digits = re.sub(r"[^\d]", "", integer_part)
    return int(digits) if digits else None
```

Tested: `1.005.000,00 → 1005000`, `1,005,000.00 → 1005000`, `53.900,00 → 53900`, `20,00 → 20`, `20.00 → 20`, `1005000 → 1005000`.

## HTML entity decoding

Many Colombian gateways send HTML-only emails with `&nbsp;`, `&iexcl;`, `&oacute;`, etc. The dispatcher must `html.unescape()` the body before regex matching. Otherwise `transacci&oacute;n` doesn't match `transacci[oó]n` and the recipe silently fails.

## Biller-name mapping

The receipt body has a free-text biller name. Map it to a Notion row via `~/.hermes/config/receipt_billers.json` (regex patterns → Notion Name). Current entries:

- `Tigo Móvil` / `Tigo Colombia` → `Tigo 📱`
- `Claro Hogar` / `Claro Internet` → `Claro 🛜`
- `Acueducto Y Energia - Emcali` / `EMCALI` → `Utilities ⚡️`
- `Gases De Occidente` → `Gas 🔥`
- `EDIFICIO PARQUE KRABI` → `Admin 🏡` (Cali HOA fee)
- `COLOMBIA TELECOMUNICACIONES` / `Movistar` → `Tigo 📱` (with `skip_price_update: true` for prepago topups)
- `Hemos recibido tu pago` → `Tigo 📱` (Movistar line 6109151707, also `skip_price_update: true`)

The map is the contract — add a new entry when a new sender/biller combination shows up. The cron dispatches without LLM involvement for known billers; unknowns go to the LLM-decides path.

## Skip-price-update semantics

Set `skip_price_update: true` on a biller map entry when the receipt is an **add-on** (Movistar prepago topup) rather than the **bill itself** (Tigo postpaid recurring). The dispatcher will:
- Attach the receipt screenshot to the page
- Mark `Paid = Done` if not already
- **Leave `Price` alone** — the row's Price is the recurring postpaid amount, not the topup

Without this flag, a $20k topup receipt PATCHed the Tigo row's `Price` to 20000, corrupting the recurring amount. 2026-07-02 real failure mode.

## Idempotency

Each receipt has a dedup key. The dispatcher checks the page for any block whose caption contains the dedup key (substring search across `image` and `heading_3` block captions) and returns `skipped_duplicate: true` if found. Safe to re-run on the same message. The caption format must include the dedup key — `Comprobante — <empresa> — $<monto> — <date> — op <dedup_key[:12]>`.

PSE/Aval same-transaction-multiple-emails: the dedup key (CUS / ID Transacción) is shared across the 3 confirmation emails, so only the first attaches. Expected.

## INBOX-only scan

The cron's `email-bills-classify-and-remind` reads INBOX only. Never search Archive / All Mail for past receipts. (2026-07-02 reobin correction: "no need to go back in time. let's just stay in july 2026.") If the user wants retroactive reconciliation, do it as a one-off manual run with explicit `--mailbox '"All Mail"'` and explicit user confirmation.
