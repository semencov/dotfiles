import { afterEach, expect, test } from "bun:test";

import { fetchPublicIp, mapConcurrent, parseIpDetails } from "../../src/utilities/network";
import { buildNamecheapUrl, parseNamecheapResponse, redactNamecheapUrl } from "../../src/utilities/namecheap";

let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(() => server?.stop(true));

test("fetchPublicIp rejects malformed service responses", async () => {
  server = Bun.serve({ port: 0, fetch: () => new Response(JSON.stringify({ ip: "203.0.113.4" })) });
  await expect(fetchPublicIp(`${server.url}ip`)).resolves.toEqual({ ip: "203.0.113.4" });
  server.stop(true);
  server = Bun.serve({ port: 0, fetch: () => new Response(JSON.stringify({ ip: "not-an-ip" })) });
  await expect(fetchPublicIp(`${server.url}ip`)).rejects.toThrow("invalid IP");
});

test("normalizes supported IP detail payloads", () => {
  expect(parseIpDetails({ status: "success", query: "203.0.113.4", isp: "Example", org: "Org", city: "Riga", country: "Latvia" })).toMatchObject({
    ip: "203.0.113.4",
    isp: "Example / Org",
    address: ["Riga", "Latvia"],
  });
  expect(() => parseIpDetails({ status: "fail" })).toThrow();
});

test("bounded concurrency preserves input order", async () => {
  let active = 0;
  let peak = 0;
  const values = await mapConcurrent([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await Bun.sleep(5);
    active -= 1;
    return value * 2;
  });
  expect(values).toEqual([2, 4, 6, 8]);
  expect(peak).toBe(2);
});

test("Namecheap responses are typed and verbose URLs redact passwords", () => {
  const url = buildNamecheapUrl({ domain: "example.com", host: "@", password: "synthetic-secret", ip: "203.0.113.4" });
  expect(url.toString()).toContain("synthetic-secret");
  expect(redactNamecheapUrl(url)).not.toContain("synthetic-secret");
  expect(redactNamecheapUrl(url)).toContain("password=%5BREDACTED%5D");
  expect(parseNamecheapResponse("<ErrCount>0</ErrCount>")).toEqual({ errors: [] });
  expect(parseNamecheapResponse("<ErrCount>1</ErrCount><Err1>Bad host</Err1>")).toEqual({ errors: ["Bad host"] });
});
