import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, hc, focused, theme, props, closeOverlay, notify } from "herdr";

const SHOWN = 10;
const ROW = 36;
const URL = /https?:\/\/[^\s<>"'`]+/g;
const URL_TAIL = /^[^\s<>"'`]+/;
// `#123` after a space or bracket, as Claude Code's footer shows a PR whose real
// address sits in a hidden (OSC 8) link that `hc read` drops.
const REF = /(^|[\s(\[])#(\d+)\b/g;

function trimUrl(url) {
  let u = url.replace(/[.,;:!?*]+$/, "");
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (u.endsWith(close) && u.split(open).length < u.split(close).length) u = u.slice(0, -1);
  }
  return u.replace(/[.,;:!?*]+$/, "");
}

function githubUrl(remote) {
  const m = remote.trim().match(/github\.com[:/](.+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

// Programs that wrap their own output (Claude Code does) split a long URL over
// lines; a URL that runs to the edge of a nearly full line continues on the next.
function extract(text, cols, repo) {
  const lines = text.split("\n");
  const found = [];
  lines.forEach((line, i) => {
    const hits = [];
    for (const m of line.matchAll(URL)) {
      let url = m[0];
      let j = i;
      while (m.index + m[0].length === line.trimEnd().length && [...lines[j].trimEnd()].length >= cols - 6 && j + 1 < lines.length) {
        const tail = lines[j + 1].trimStart().match(URL_TAIL);
        if (!tail) break;
        url += tail[0];
        j++;
        if (tail[0].length < lines[j].trim().length) break;
      }
      hits.push({ at: m.index, url: trimUrl(url) });
    }
    if (repo) for (const m of line.matchAll(REF)) hits.push({ at: m.index, url: `${repo}/issues/${m[2]}` });
    found.push(...hits.sort((a, b) => a.at - b.at).map((h) => h.url));
  });
  const seen = new Set();
  return found.reverse().filter((u) => !seen.has(u) && seen.add(u));
}

function split(url) {
  const rest = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const cut = rest.search(/[/?#]/);
  return cut === -1 ? [rest, ""] : [rest.slice(0, cut), rest.slice(cut)];
}

export default class Links extends View {
  init(_props, cx) {
    this.links = null;
    this.at = 0;
    this.top = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
    cx.spawn(async (cx) => {
      const error = await this.load();
      if (error || this.links.length === 0) {
        notify({ title: error ?? "No links on screen", level: error ? "error" : "info", timeout: 2500 });
        return this.close();
      }
      cx.notify();
    });
  }

  async load() {
    const { terminal, cwd } = focused() ?? {};
    if (!terminal) return "No terminal has focus";
    const [read, info, remote] = await Promise.all([
      hc(["read", terminal, "--json"]),
      hc(["get", terminal, "--json"]),
      cwd ? exec("git", ["-C", cwd, "remote", "get-url", "origin"]).catch(() => null) : null,
    ]);
    if (read.code !== 0) return read.stderr.trim() || "Couldn't read the terminal";
    const cols = info.code === 0 ? JSON.parse(info.stdout).cols ?? 80 : 80;
    const repo = remote?.code === 0 ? githubUrl(remote.stdout) : null;
    this.links = extract(JSON.parse(read.stdout).text ?? "", cols, repo);
    return null;
  }

  close() {
    closeOverlay(props().overlay);
  }

  open(url) {
    if (!url) return;
    this.close();
    exec("open", [url]);
  }

  move(by) {
    this.at = Math.max(0, Math.min(this.links.length - 1, this.at + by));
    if (this.at < this.top) this.top = this.at;
    if (this.at >= this.top + SHOWN) this.top = this.at - SHOWN + 1;
  }

  key(e, cx) {
    const k = e.key;
    const ctrl = e.modifiers.control;
    if (k === "escape") return this.close();
    if (k === "enter") return this.open(this.links?.[this.at]);
    if (!this.links) return;
    if (k === "down" || k === "j" || (ctrl && k === "n")) this.move(1);
    else if (k === "up" || k === "k" || (ctrl && k === "p")) this.move(-1);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  render() {
    const t = theme();
    const links = this.links ?? [];
    const shown = links.slice(this.top, this.top + SHOWN);

    const row = (url, i) => {
      const on = this.top + i === this.at;
      const [host, path] = split(url);
      return h_flex()
        .id(`link-${this.top + i}`)
        .h(ROW)
        .flex_none()
        .px(12)
        .rounded(8)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.selected))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.open(url))
        .child(div().flex_none().text_color(t.foreground).font_weight(500).child(host))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(path));
    };

    const card = this.links === null ? div() :
      v_flex()
        .id("links-card")
        .w_full()
        .flex_none()
        .bg(t.popover)
        .border_1()
        .border_color(t.border)
        .rounded(12)
        .shadow_lg()
        .overflow_hidden()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(
          h_flex().h(40).px(16).gap(8).items_center().border_b_1().border_color(t.border)
            .child(svg("mods/links/link.svg").size(14).flex_none().text_color(t.muted))
            .child(div().text_color(t.foreground).font_weight(600).child("Links"))
            .child(div().text_color(t.dim).child(String(links.length))),
        )
        .child(v_flex().p(6).gap(2).h(shown.length * (ROW + 2) + 10).flex_none().children(shown.map(row)));

    return v_flex()
      .id("links")
      .track_focus(this.handle)
      .size_full()
      .text_size(13)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_mouse_down("left", () => this.close())
      .child(card);
  }
}
