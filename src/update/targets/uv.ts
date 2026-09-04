import { commandUpdate } from "./shared";
export const uvUpdate = () => commandUpdate({ id: "uv-tools", title: "uv tools", tool: "uv", commands: () => [{ executable: "uv", args: ["tool", "upgrade", "--all"] }] });
