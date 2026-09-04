import type { UpdateTarget } from "../types";
import { UpdateCancelledError } from "../errors";
import { commandUpdate } from "./shared";

function guarded(target: UpdateTarget): UpdateTarget {
  return { ...target, update: async (context) => {
    if (context.nonInteractive) throw new Error(`${target.id} requires interactive confirmation`);
    if (!await context.prompts.confirm({ message: `Run ${target.title}?`, initialValue: false })) throw new UpdateCancelledError();
    await target.update(context);
  } };
}

export const macosSystemUpdate = () => guarded(commandUpdate({ id: "macos-system-update", title: "macOS system update", tool: "softwareupdate", platforms: ["macos"], defaultSelected: false, group: "os", commands: () => [{ executable: "softwareupdate", args: ["--install", "--all"] }] }));
export const debianSystemUpdate = () => guarded(commandUpdate({ id: "debian-system-update", title: "Debian system update", tool: "apt-get", platforms: ["ubuntu", "debian"], defaultSelected: false, group: "os", commands: () => [{ executable: "sudo", args: ["apt-get", "update"] }, { executable: "sudo", args: ["apt-get", "upgrade", "-y"] }] }));
