import { join, resolve } from "node:path";

import { CommandCatalog } from "./catalog";

export async function commandHelp(repository: string, name: string): Promise<string> {
  const child = Bun.spawn([join(repository, "bin", name), "--help"], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`${name} --help failed: ${stderr.trim()}`);
  return stdout.replaceAll("\r\n", "\n").trim();
}

export async function renderCommandReference(
  catalog: CommandCatalog,
  help: (name: string) => Promise<string>,
): Promise<string> {
  const sections = await Promise.all(catalog.commands.map(async (command) => {
    const tools = command.externalTools.length === 0 ? "None" : command.externalTools.map((tool) => `\`${tool}\``).join(", ");
    return [
      `## ${command.name}`,
      "",
      command.summary,
      "",
      `Platforms: ${command.platforms.join(", ")}. External tools: ${tools}.`,
      "",
      "```text",
      await help(command.name),
      "```",
    ].join("\n");
  }));
  return `# Utility commands\n\n> Generated from \`config/commands.json\` and executable \`--help\` output. Do not edit manually.\n\n${sections.join("\n\n")}\n`;
}

if (import.meta.main) {
  const repository = resolve(import.meta.dir, "../..");
  if (Bun.argv.slice(2).join(" ") !== "--write") throw new Error("Usage: bun src/utilities/docs.ts --write");
  const catalog = await CommandCatalog.load(join(repository, "config", "commands.json"));
  await Bun.write(
    join(repository, "docs", "commands.md"),
    await renderCommandReference(catalog, (name) => commandHelp(repository, name)),
  );
}
