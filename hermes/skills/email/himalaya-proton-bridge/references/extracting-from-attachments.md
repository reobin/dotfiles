---
name: extracting-from-attachments
description: "Workflow for pulling data out of email attachments (PDF, ZIP+XML, HTML, images) when the email body is just a 'see attached' notification. Pair with himalaya attachment download."
---

# Extracting data from email attachments

## The pattern

When an email body says "see attached invoice / statement / notice", the data isn't in the body — it's in a PDF, ZIP, or image. Don't report "I can't get the amount" until you've pulled the attachment.

## Step 1: download the attachments

```bash
mkdir -p /tmp/hermes-attachments
himalaya attachment download -d /tmp/hermes-attachments <ID>
```

`-d` sets the destination. The default is `XDG_DOWNLOAD_DIR` (often `~/Downloads`). For one-off extraction, `/tmp/hermes-attachments` is fine; the files are throwaway.

## Step 2: identify what you got

```bash
ls -la /tmp/hermes-attachments/
file /tmp/hermes-attachments/*
```

Bills and invoices come in a few common shapes:

| Format | What it is | How to read |
|---|---|---|
| `.pdf` | Invoice, statement, notice | `pdftotext -layout <file> -` (from `brew install poppler`) |
| `.zip` containing `.xml` + `.pdf` | UBL/structured electronic invoice (common in Colombia, EU, many B2B contexts) | Unzip, then parse the XML — it's almost always more reliable than the PDF |
| `.zip` containing only `.pdf` | Same as a standalone PDF | Unzip, then `pdftotext` |
| `.html` / `.htm` inside the email | Some senders embed the invoice in the body part | `himalaya message read` with appropriate flags, or save the part and use a tool like `pup`/`html2text` |
| `.jpg` / `.png` of a document | Scanned image, no text layer | OCR via `tesseract` (from `brew install tesseract`) or vision_analyze on the file path |

## Step 3: read it

**For PDFs (text-based, the usual case for bills):**
```bash
brew install poppler   # one-time, gives you pdftotext, pdfimages, mutool
pdftotext -layout /tmp/hermes-attachments/invoice.pdf - | head -200
```
The `-layout` flag preserves table structure. Pipe to `head`/`grep`/etc. to extract specific fields.

**For UBL-style XML inside a zip (Colombian DIAN, EU e-invoices):**
```bash
unzip -o /tmp/hermes-attachments/invoice.zip -d /tmp/hermes-attachments/invoice/
# Look for: cbc:PayableAmount (total), cbc:PaymentDueDate (due date),
#           cbc:DueDate (alt due date), cbc:IssueDate, cbc:LineExtensionAmount (line items),
#           cac:PartyName (sender/receiver), cac:RegistrationAddress (address)
#           cbc:AccountingCostCode (the "No. Pago Electrónico" for EMCALI bills)
```
Common namespaces: `urn:oasis:names:specification:ubl:schema:xsd:Invoice-2` (`cac:`, `cbc:`).

**For EMCALI specifically:** the "No. Pago Electrónico" is printed in the PDF as a bare 9-digit number (e.g. `532571952`) on the payment slip in the upper-right of page 1. It's also in the XML as `cbc:AccountingCostCode`. Always extract it; the user stores it as `Electronic Payment Code` in the Notion bills database. **The ref is unique per month** — never copy last month's ref forward; the new bill's email always carries a fresh one.

**For images (scanned bills, no text layer):**
```bash
brew install tesseract tesseract-lang    # one-time
tesseract /tmp/hermes-attachments/scan.jpg stdout -l spa+eng   # adjust languages
```
Or: `vision_analyze(image_url="/tmp/hermes-attachments/scan.jpg", question="extract total amount, due date, account number")` — works on scanned/handwritten text where tesseract stumbles.

## Pitfalls

### 1. `himalaya message read` only shows the body, not attachments

The body lists `<#part type=application/pdf filename="...">` placeholders. The attachment is **not** automatically downloaded to `~/Downloads` — that filename in the read output is just what the sender named it, not an on-disk path. You need `himalaya attachment download`.

### 2. `pdftotext` may not be installed

macOS does not ship with `pdftotext`. `brew install poppler` adds it. Same for `tesseract` (image OCR). Both are small and Brewfile-worthy if you do this often.

### 3. Scanned/image PDFs (no text layer)

`pdftotext` returns empty on a scanned PDF. Check with `pdfinfo <file>` — if `Form: none` and `Text stream` is empty, it's a scan. Fall back to `pdfimages -j` to extract the embedded JPEG, then `tesseract` it.

### 4. UBL XML: amount fields are currency-tagged

`<cbc:PayableAmount currencyID="COP">636525.00</cbc:PayableAmount>` — the amount and the currency are both in the same node. Don't grep for just the number; you'll get false matches from tax IDs and other numerics.

### 5. Don't guess based on filename

"Factura EmCali.zip" doesn't tell you whether it contains a PDF, XML, or both. Always unzip first, then look at what's inside. Colombian DIAN electronic invoices typically ship as a zip with `*.xml` (structured data) and `*.pdf` (rendered view) — the XML is the source of truth.

## Verification

After extraction, the result should be self-consistent: if you got a "total" and per-line "line extension amounts", the line amounts should sum to the total. If they don't, one of the values is wrong (often a tax/IVA line that shouldn't be added separately).
