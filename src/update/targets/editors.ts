import type { UpdateTarget } from "../types";
import { runCommands } from "./shared";
const editors = ["code", "cursor", "zed"] as const;

export const editorUpdate = (): UpdateTarget => ({
  id: "editor-extensions",
  title: "Editor extensions",
  platforms: ["macos", "ubuntu", "debian"],
  dependencies: [],
  defaultSelected: true,
  group: "editor-extensions",
  preflight: async (context) => {
    for (const editor of editors) {
      if (await context.process.which(editor) !== null) return { ok: true };
    }
    return { ok: false, detail: "No supported editor CLI is available" };
  },
  update: async (context) => {
    const available: string[] = [];
    for (const editor of editors) {
      if (await context.process.which(editor) !== null) available.push(editor);
    }
    await runCommands(context, available.map((executable) => ({ executable, args: ["--update-extensions"] })));
  },
  verify: async () => ({ ok: true }),
});
