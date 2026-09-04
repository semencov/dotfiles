import { UtilityUsageError } from "./runtime";

export type RsyncDirection = "from" | "to";

export function rsyncOperands(direction: RsyncDirection, remote: string, local: string): readonly string[] {
  if (remote.length === 0 || remote.startsWith("-")) throw new UtilityUsageError("Invalid rsync remote operand");
  const common = ["-rvazph", "--force", "--delete", "--progress", "--"];
  return direction === "from" ? [...common, remote, local] : [...common, local, remote];
}
