import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Labels the Herdr terminal with the session file, so the sidetrack mod can fork it.
export default function (pi: ExtensionAPI) {
  const terminal = process.env.HC_TERMINAL_ID;
  const label = (value: string) => pi.exec("hc", ["label", terminal, `pi.session=${value}`]).catch(() => {});
  // Once the space is named (or we nudged once), stop checking.
  let spaceSettled = false;

  pi.on("session_start", async (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    if (terminal && file) await label(file);
  });

  pi.on("session_shutdown", async () => {
    if (terminal) await label("");
  });

  // Mirror the Claude UserPromptSubmit hook: while the Herdr space still
  // carries its default folder-basename, nudge the model to rename it.
  pi.on("before_agent_start", async (event) => {
    try {
      if (event.messageType !== "user") return;
      if (!terminal || spaceSettled) return;

      const got = await pi.exec("hc", ["get", terminal], { timeout: 5000 }).catch(() => undefined);
      const spaceId = (JSON.parse(got?.stdout ?? "{}") as { labels?: Record<string, string> })?.labels?.["herdr.space"];
      if (!spaceId) {
        spaceSettled = true;
        return;
      }

      const listed = await pi.exec("herdr-app", ["ls"], { timeout: 5000 }).catch(() => undefined);
      const spaces = (JSON.parse(listed?.stdout ?? "{}") as {
        spaces?: Array<{ id?: string; name?: string; folder?: string }>;
      })?.spaces;
      const space = spaces?.find((s) => s.id === spaceId);
      if (!space) return;

      const basename = (space.folder ?? "").replace(/\/+$/, "").split("/").pop() ?? "";
      if (space.name !== basename) {
        spaceSettled = true;
        return;
      }

      spaceSettled = true;
      return {
        message: {
          customType: "herdr-space-rename",
          content: `Name your Herdr space after this prompt, without mentioning it: herdr-app do space.rename --id ${space.id} --name <label>`,
          display: false,
        },
      };
    } catch {
      // Never break the turn for a naming nudge.
    }
  });
}
