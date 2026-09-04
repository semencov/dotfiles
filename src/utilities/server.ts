import { resolve, sep } from "node:path";

import { UtilityUsageError } from "./runtime";

export function validatePort(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new UtilityUsageError(`Invalid port: ${value}`);
  const port = Number(value);
  if (port < 1 || port > 65_535) throw new UtilityUsageError(`Invalid port: ${value}`);
  return port;
}

export function startStaticServer(root: string, port: number): ReturnType<typeof Bun.serve> {
  const canonicalRoot = resolve(root);
  return Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return new Response("Bad request\n", { status: 400 });
      }
      const requested = resolve(canonicalRoot, `.${pathname}`);
      if (requested !== canonicalRoot && !requested.startsWith(`${canonicalRoot}${sep}`)) return new Response("Not found\n", { status: 404 });
      let file = Bun.file(requested);
      if (pathname.endsWith("/")) file = Bun.file(resolve(requested, "index.html"));
      if (!await file.exists()) return new Response("Not found\n", { status: 404 });
      return new Response(file);
    },
  });
}
