import { commandUpdate } from "./shared";
export const bunUpdate = () => commandUpdate({ id: "bun-globals", title: "Bun global packages", tool: "bun", commands: () => [{ executable: "bun", args: ["update", "--global"] }] });
