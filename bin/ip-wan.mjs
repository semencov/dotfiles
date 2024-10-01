#!/usr/bin/env zx

/**
 * Show WAN IP
 */

try {
  await $`dig +short myip.opendns.com @resolver1.opendns.com`;
  echo(result);
} catch (error) {
  console.error("Error fetching WAN IP:", error.message);
  process.exit(1);
}
