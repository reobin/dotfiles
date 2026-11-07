import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, home, readTextFile, pickFolder, run, theme, props, closeOverlay } from "herdr";

const ROOTS = "~/.config/herdr-app/mods/new-space/roots";
const SHOWN = 12;
const ROW = 32;

export default class NewSpace extends View {
  init(_props, cx) {
    this.home = home();
    this.dirs = [];
    this.filter = "";
    this.at = 0;
    this.top = 0;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Pick a folder for the new space…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.top = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.go(this.rows()[this.at], cx));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    cx.spawn(async (cx) => { this.dirs = await this.load(); cx.notify(); });
  }

  expand(p) {
    return p.startsWith("~") ? this.home + p.slice(1) : p;
  }

  short(p) {
    return p.startsWith(this.home) ? "~" + p.slice(this.home.length) : p;
  }

  async subdirs(base) {
    const r = await exec("find", [base, "-mindepth", "1", "-maxdepth", "1", "-type", "d", "-not", "-name", ".*"]);
    return r.code === 0 ? r.stdout.split("\n").filter(Boolean).sort() : [];
  }

  async load() {
    const roots = [];
    const text = (await readTextFile(this.expand(ROOTS))) ?? "";
    for (const line of text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))) {
      const p = this.expand(line);
      if (p.endsWith("/*")) roots.push(...(await this.subdirs(p.slice(0, -2))));
      else roots.push(p);
    }
    let recent = [];
    try {
      const r = await exec("zoxide", ["query", "-l"]);
      if (r.code === 0) recent = r.stdout.split("\n").filter(Boolean);
    } catch {}
    return [...new Set([...recent, ...roots])];
  }

  rows() {
    const terms = this.filter.toLowerCase().split(/\s+/).filter(Boolean);
    const dirs = this.dirs.filter((d) => terms.every((w) => this.short(d).toLowerCase().includes(w)));
    return [...dirs.map((d) => ({ kind: "dir", path: d })), { kind: "browse" }];
  }

  close() {
    closeOverlay(props().overlay);
  }

  go(r, cx) {
    if (!r) return;
    if (r.kind === "dir") {
      this.close();
      run("space.new", { folder: r.path, machine: "" });
      return;
    }
    cx.spawn(async () => {
      const folder = await pickFolder({ prompt: "Folder for the new space" });
      this.close();
      if (folder) run("space.new", { folder, machine: "" });
    });
  }

  move(by, n) {
    this.at = Math.max(0, Math.min(n - 1, this.at + by));
    if (this.at < this.top) this.top = this.at;
    if (this.at >= this.top + SHOWN) this.top = this.at - SHOWN + 1;
  }

  render() {
    const t = theme();
    const rows = this.rows();
    this.at = Math.min(this.at, rows.length - 1);
    this.top = Math.max(0, Math.min(this.top, rows.length - SHOWN));
    const shown = rows.slice(this.top, this.top + SHOWN);

    const row = (r, i) => {
      const on = this.top + i === this.at;
      const browse = r.kind === "browse";
      const path = browse ? "" : this.short(r.path);
      const cut = path.lastIndexOf("/");
      return h_flex()
        .id(browse ? "ns-browse" : `ns-${r.path}`)
        .mx(4)
        .px(10)
        .h(ROW)
        .flex_none()
        .rounded(7)
        .gap(10)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.go(r, cx))
        .when(browse, (el) => el.text_color(t.muted).child(div().w(12).child("…")).child("Browse…"))
        .when(!browse, (el) =>
          el.child(svg("mods/files/folder.svg").size(13).flex_none().text_color(t.dim))
            .child(div().flex_none().text_color(t.foreground).child(path.slice(cut + 1)))
            .child(div().flex_1().truncate().text_size(11).text_color(t.dim).child(path.slice(0, cut + 1))));
    };

    return v_flex()
      .id("new-space")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key;
        const ctrl = e.modifiers.control;
        if (k === "escape") return this.close();
        if (k === "down" || (ctrl && (k === "n" || k === "j"))) this.move(1, rows.length);
        else if (k === "up" || (ctrl && (k === "p" || k === "k"))) this.move(-1, rows.length);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("New space in…")).child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(
        h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)),
      )
      .child(
        v_flex()
          .h(Math.min(SHOWN, rows.length) * ROW)
          .flex_none()
          .mb(6)
          .children(shown.map(row)),
      );
  }
}
