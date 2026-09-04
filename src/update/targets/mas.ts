import { commandUpdate } from "./shared";
export const masUpdate = () => commandUpdate({ id: "mas-apps", title: "Mac App Store apps", tool: "mas", platforms: ["macos"], commands: () => [{ executable: "mas", args: ["upgrade"] }] });
