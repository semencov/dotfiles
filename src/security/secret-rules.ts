export interface SecurityFinding {
  readonly rule: string;
  readonly path: string;
  readonly line?: number;
}

interface SecretRule {
  readonly id: string;
  readonly pattern: RegExp;
}

const RULES: readonly SecretRule[] = [
  { id: "aws-access-key", pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  { id: "github-token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { id: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{20,}\b/g },
  { id: "private-key", pattern: /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/g },
  { id: "netrc-credentials", pattern: /^\s*machine\s+\S+\s+login\s+\S+\s+password\s+\S+/gm },
  { id: "auth-json", pattern: /["'](?:accessToken|refreshToken|authToken|privateKey)["']\s*:\s*["'][^"']{8,}["']/g },
  { id: "suspicious-secret-assignment", pattern: /(?:^|\n)\s*(?:export\s+)?(?:token|secret|password|api[_-]?key)\s*=\s*["']?[A-Za-z0-9+/=_-]{24,}/gi },
];

function lineNumber(contents: string, offset: number): number {
  return contents.slice(0, offset).split("\n").length;
}

export function scanSecrets(path: string, contents: string): readonly SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const { id, pattern } of RULES) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) {
      findings.push({ rule: id, path, line: lineNumber(contents, match.index) });
    }
  }
  return findings;
}
