export interface GitStatus {
  readonly clean: boolean;
  readonly ahead: number;
  readonly behind: number;
}

export type MergeStartResult = "unchanged" | "merged" | "conflicted";

export type ConflictSide = "ours" | "theirs";
