const expand = (text) => text.replace(/\t/g, "    ");

export const lineCount = (row, cols) => !cols || !row ? 1 : Math.max(1, Math.ceil(expand(row.text ?? "").length / cols));

// A row's colored spans cut into screen lines of `cols` characters (one line when cols is 0).
export function wrapSpans(spans, cols) {
  const lines = [[]];
  let used = 0;
  for (const span of spans) {
    let text = expand(span.text);
    if (!cols) { lines[0].push({ ...span, text }); continue; }
    while (text.length) {
      if (used >= cols) { lines.push([]); used = 0; }
      const piece = text.slice(0, cols - used);
      lines[lines.length - 1].push({ ...span, text: piece });
      used += piece.length;
      text = text.slice(piece.length);
    }
  }
  return lines;
}

// Side-by-side lines: removed rows on the left beside the added rows that replaced them,
// unchanged rows on both sides, hunk headers and notes across.
export function pairs(rows) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    const kind = rows[i].kind;
    if (kind === "-" || kind === "+") {
      const dels = [], adds = [];
      while (i < rows.length && rows[i].kind === "-") dels.push(i++);
      while (i < rows.length && rows[i].kind === "+") adds.push(i++);
      for (let k = 0; k < Math.max(dels.length, adds.length); k++) out.push({ t: "pair", l: dels[k] ?? null, r: adds[k] ?? null });
    } else if (kind === " ") out.push({ t: "pair", l: i, r: i++ });
    else out.push({ t: "row", i: i++ });
  }
  return out;
}
