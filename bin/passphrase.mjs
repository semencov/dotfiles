#!/usr/bin/env zx

// Human readable password generator.
// Based on https://github.com/Version2beta/passphrase

const NAMES_DICT = "/usr/share/dict/propernames";
const DICT = "/usr/share/dict/words";

// Read files and split into arrays
const names = (await fs.readFile(NAMES_DICT, 'utf-8')).split('\n').filter(Boolean);
const words = (await fs.readFile(DICT, 'utf-8')).split('\n').filter(Boolean);

// Helper function to get random items from array
function getRandomItems(arr, count) {
  return Array.from({ length: count }, () => {
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
  });
}

// Get random name and words
const [name] = getRandomItems(names, 1);
const randomWords = getRandomItems(words, 2);

// Build phrase
const phrase = [name, ...randomWords]
  .map(word => word.toLowerCase())
  .join('');

console.log(phrase);
