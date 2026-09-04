import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { rsyncOperands } from "../../src/utilities/rsync";
import { startStaticServer, validatePort } from "../../src/utilities/server";
import { renderSshHost, validateSshIdentifier } from "../../src/utilities/ssh";

let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(() => server?.stop(true));

test("ports are validated within TCP bounds", () => {
  expect(validatePort("1", 8000)).toBe(1);
  expect(validatePort("65535", 8000)).toBe(65535);
  expect(() => validatePort("0", 8000)).toThrow();
  expect(() => validatePort("wat", 8000)).toThrow();
});

test("rsync operands remain literal and separated from options", () => {
  expect(rsyncOperands("from", "host:/path with spaces", "/tmp/local")).toEqual([
    "-rvazph", "--force", "--delete", "--progress", "--", "host:/path with spaces", "/tmp/local",
  ]);
  expect(() => rsyncOperands("to", "--delete-before", "/tmp/local")).toThrow();
});

test("SSH identifiers and stanzas are strict", () => {
  expect(validateSshIdentifier("example_com")).toBe("example_com");
  expect(() => validateSshIdentifier("../key")).toThrow();
  expect(renderSshHost({ identifier: "example", host: "example.com", port: 2222, username: "deploy", identityFile: "~/.ssh/example.id_ed25519" }))
    .toBe("Host example example.com\n\tHostName example.com\n\tPort 2222\n\tUser deploy\n\tIdentityFile ~/.ssh/example.id_ed25519\n");
});

test("static server serves contained files and rejects traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "server-"));
  await mkdir(join(root, "nested"));
  await Bun.write(join(root, "index.html"), "<h1>ok</h1>");
  server = startStaticServer(root, 0);
  expect(await (await fetch(server.url)).text()).toBe("<h1>ok</h1>");
  expect((await fetch(new URL("/%2e%2e/secret", server.url))).status).toBe(404);
});
