import { commandUpdate } from "./shared";

export const homebrewUpdate = () => commandUpdate({ id: "homebrew", title: "Homebrew packages", tool: "brew", group: "homebrew", commands: () => [{ executable: "brew", args: ["update"] }, { executable: "brew", args: ["upgrade"] }] });
export const greedyCaskUpdate = () => commandUpdate({ id: "homebrew-greedy-casks", title: "Homebrew greedy casks", tool: "brew", group: "homebrew", dependencies: ["homebrew"], defaultSelected: false, platforms: ["macos"], commands: () => [{ executable: "brew", args: ["upgrade", "--cask", "--greedy"] }] });
