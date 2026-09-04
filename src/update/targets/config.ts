import { commandUpdate } from "./shared";
export const configUpdate = () => commandUpdate({ id: "config", title: "Managed configuration", tool: "chezmoi", group: "config", commands: (context) => [{ executable: "chezmoi", args: ["--config", context.paths.chezmoiConfig, "--source", context.paths.repo, "apply", "--force", "--no-tty"] }] });
