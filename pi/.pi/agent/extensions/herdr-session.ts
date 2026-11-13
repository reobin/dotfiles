import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Labels the Herdr terminal with the session file, so the sidetrack mod can fork it.
export default function (pi: ExtensionAPI) {
  const terminal = process.env.HC_TERMINAL_ID;
  const label = (value: string) => pi.exec("hc", ["label", terminal, `pi.session=${value}`]).catch(() => {});

  pi.on("session_start", async (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    if (terminal && file) await label(file);
  });

  pi.on("session_shutdown", async () => {
    if (terminal) await label("");
  });
}
