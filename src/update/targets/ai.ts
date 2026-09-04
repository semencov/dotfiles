import { commandUpdate } from "./shared";
export const aiUpdate = () => commandUpdate({ id: "ai-tools", title: "AI plugins", tool: "claude", commands: () => [{ executable: "claude", args: ["plugin", "update", "--all"] }] });
