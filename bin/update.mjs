#!/usr/bin/env zx

$.verbose = false;

await $`sudo -v`;

await spinner("Updating dotfiles...",
  () => within(async () => {
    cd(`${$.env.HOME}/.dotfiles`);
    await $`pull`;
    return $`python3 ./sync.py`;
  })
);

await spinner("Updating macOS...",
  async () => {
    await $`sudo -v`;
    return $`sudo softwareupdate --all --install --force`;
  }
);

await spinner("Updating Homebrew...",
  async () => {
    await $`brew upgrade`;
    await $`brew cleanup`;
    return $`brew doctor`;
  }
);

await spinner("Updating npm...", () => $`npm-check -gsy`);
