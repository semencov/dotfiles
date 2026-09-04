import { commandUpdate } from "./shared";
export const ghUpdate = () => commandUpdate({ id: "gh-extensions", title: "GitHub CLI extensions", tool: "gh", commands: () => [{ executable: "gh", args: ["extension", "upgrade", "--all"] }] });
