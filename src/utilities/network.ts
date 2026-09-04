import { Resolver } from "node:dns/promises";
import { networkInterfaces } from "node:os";
import { isIP } from "node:net";

import { UtilityOperationalError } from "./runtime";

export interface PublicIpResult {
  readonly ip: string;
}

export interface IpDetails {
  readonly ip: string;
  readonly as: string;
  readonly isp: string;
  readonly address: readonly string[];
  readonly timezone: string;
  readonly lat: number | string;
  readonly lon: number | string;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new UtilityOperationalError("Service returned malformed JSON");
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = "N/A"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export async function fetchPublicIp(endpoint = "https://api.ipify.org?format=json"): Promise<PublicIpResult> {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new UtilityOperationalError(`Public IP service returned HTTP ${response.status}`);
  const contents = (await response.text()).trim();
  let value: unknown = contents;
  if (contents.startsWith("{")) {
    try {
      value = record(JSON.parse(contents) as unknown).ip;
    } catch {
      throw new UtilityOperationalError("Public IP service returned malformed JSON");
    }
  }
  if (typeof value !== "string" || isIP(value) === 0) throw new UtilityOperationalError("Public IP service returned an invalid IP address");
  return { ip: value };
}

export function parseIpDetails(value: unknown): IpDetails {
  const source = record(value);
  if (source.status === "fail" || source.success === false) throw new UtilityOperationalError(text(source.message, "IP lookup failed"));
  const location = typeof source.location === "object" && source.location !== null ? record(source.location) : source;
  const connection = typeof source.connection === "object" && source.connection !== null ? record(source.connection) : source;
  const ip = text(source.query ?? source.ip);
  if (isIP(ip) === 0) throw new UtilityOperationalError("IP service returned an invalid IP address");
  const isp = text(source.isp ?? connection.isp);
  const org = text(source.org ?? connection.org, isp);
  return {
    ip,
    as: text(source.as ?? connection.asn),
    isp: org === isp ? isp : `${isp} / ${org}`,
    address: [location.city, location.regionName ?? location.state, location.country]
      .filter((item): item is string => typeof item === "string" && item.length > 0),
    timezone: text(location.timezone),
    lat: typeof location.lat === "number" || typeof location.lat === "string" ? location.lat : "N/A",
    lon: typeof location.lon === "number" || typeof location.lon === "string"
      ? location.lon
      : typeof location.longitude === "number" || typeof location.longitude === "string" ? location.longitude : "N/A",
  };
}

export async function fetchIpDetails(endpoint: string): Promise<IpDetails> {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new UtilityOperationalError(`IP service returned HTTP ${response.status}`);
  return parseIpDetails(await response.json());
}

export function renderIpDetails(value: IpDetails): string {
  return [
    `      IP: ${value.ip}`,
    ` ISP/Org: ${value.isp}`,
    `      AS: ${value.as}`,
    ` Address: ${value.address.join(", ")}`,
    `Timezone: ${value.timezone}`,
    `Location: ${value.lat}, ${value.lon}`,
  ].join("\n");
}

export function localIp(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  throw new UtilityOperationalError("No local IPv4 address found");
}

export async function mapConcurrent<T, R>(
  values: readonly T[],
  limit: number,
  operation: (value: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new UtilityOperationalError("Concurrency limit must be positive");
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index]!, index);
    }
  }));
  return results;
}

export async function resolveDomain(domain: string, timeoutMs = 5_000): Promise<readonly string[]> {
  const resolver = new Resolver();
  resolver.setServers(["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4"]);
  return Promise.race([
    resolver.resolve4(domain),
    new Promise<never>((_, reject) => setTimeout(() => reject(new UtilityOperationalError("DNS timeout")), timeoutMs)),
  ]);
}
