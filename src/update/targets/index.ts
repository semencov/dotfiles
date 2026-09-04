import type { UpdateTarget } from "../types";
import { aiUpdate } from "./ai";
import { bunUpdate } from "./bun";
import { configUpdate } from "./config";
import { editorUpdate } from "./editors";
import { ghUpdate } from "./gh";
import { greedyCaskUpdate, homebrewUpdate } from "./homebrew";
import { masUpdate } from "./mas";
import { debianSystemUpdate, macosSystemUpdate } from "./os";
import { uvUpdate } from "./uv";

export function updateTargets(): readonly UpdateTarget[] {
  return [homebrewUpdate(), greedyCaskUpdate(), bunUpdate(), uvUpdate(), editorUpdate(), ghUpdate(), masUpdate(), aiUpdate(), configUpdate(), macosSystemUpdate(), debianSystemUpdate()];
}
