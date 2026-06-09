#!/usr/bin/env zx

// Tldr wrapper to show docs from ~/dotfiles/docs
//
// Usage:
//   help command
//
// See more:
// https://github.com/tldr-pages/tldr-node-client
//

process.env.FORCE_COLOR = "1";

const {
	_: [command = ""],
} = argv;

const root = path.resolve(__dirname, "..");
const mdFile = path.join(root, "docs", `${command}.md`);

if (await fs.pathExists(mdFile)) {
	echo(await $`tldr --render ${mdFile}`);
} else {
	echo(await $`tldr ${argv._.join(" ")}`);
}
