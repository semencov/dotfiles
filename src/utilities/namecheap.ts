import { isIP } from "node:net";

import { UtilityOperationalError, UtilityUsageError } from "./runtime";

export interface NamecheapInput {
  readonly domain: string;
  readonly host: string;
  readonly password: string;
  readonly ip: string;
}

export interface NamecheapResult {
  readonly errors: readonly string[];
}

export function buildNamecheapUrl(input: NamecheapInput): URL {
  if (!/^[A-Za-z0-9.-]+$/.test(input.domain)) throw new UtilityUsageError("Invalid Namecheap domain");
  if (!/^[@*A-Za-z0-9._-]+$/.test(input.host)) throw new UtilityUsageError("Invalid Namecheap host");
  if (input.password.length === 0) throw new UtilityUsageError("Namecheap password is empty");
  if (isIP(input.ip) === 0) throw new UtilityUsageError("Invalid IP address");
  const url = new URL("https://dynamicdns.park-your-domain.com/update");
  url.searchParams.set("host", input.host);
  url.searchParams.set("domain", input.domain);
  url.searchParams.set("password", input.password);
  url.searchParams.set("ip", input.ip);
  return url;
}

export function redactNamecheapUrl(url: URL): string {
  const safe = new URL(url);
  safe.searchParams.set("password", "[REDACTED]");
  return safe.toString();
}

export function parseNamecheapResponse(xml: string): NamecheapResult {
  const count = /<ErrCount>(\d+)<\/ErrCount>/i.exec(xml)?.[1];
  if (count === undefined) throw new UtilityOperationalError("Namecheap returned malformed XML");
  const errors = [...xml.matchAll(/<Err\d+>([^<]*)<\/Err\d+>/gi)].map((match) => match[1] ?? "Unknown error");
  if (Number(count) > 0 && errors.length === 0) return { errors: ["Namecheap rejected the update"] };
  return { errors };
}
