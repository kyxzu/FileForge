import test from "node:test";
import assert from "node:assert/strict";
import { filterCommands, highlightParts } from "../src/lib/commandSearch.js";

const commands = [
  { id: "converter", label: "Open Image Converter", keywords: "convert png jpeg webp" },
  { id: "compressor", label: "Open Image Compressor", keywords: "compress smaller reduce" },
  { id: "history", label: "Open Processing History", keywords: "past records" },
  { id: "theme", label: "Toggle theme", keywords: "dark light appearance" },
  { id: "github", label: "Open GitHub repository", keywords: "source code" },
];

test("an empty query returns every command in order", () => {
  assert.deepEqual(filterCommands(commands, "").map((c) => c.id), commands.map((c) => c.id));
  assert.deepEqual(filterCommands(commands, "   ").length, commands.length);
});

test("matching is case-insensitive and substring based", () => {
  assert.deepEqual(filterCommands(commands, "HISTORY").map((c) => c.id), ["history"]);
  assert.deepEqual(filterCommands(commands, "compr").map((c) => c.id), ["compressor"]);
});

test("every word must match, in any order", () => {
  assert.deepEqual(filterCommands(commands, "image open").map((c) => c.id), ["converter", "compressor"]);
  assert.deepEqual(filterCommands(commands, "converter zzz"), []);
});

test("keywords match when the label does not", () => {
  assert.deepEqual(filterCommands(commands, "webp").map((c) => c.id), ["converter"]);
  assert.deepEqual(filterCommands(commands, "dark").map((c) => c.id), ["theme"]);
});

test("label matches outrank keyword matches; word starts outrank the middle of a word", () => {
  const list = [
    { id: "a", label: "Settings", keywords: "theme" },
    { id: "b", label: "Toggle theme", keywords: "" },
    { id: "c", label: "Bathemes", keywords: "" },
  ];
  assert.deepEqual(filterCommands(list, "theme").map((c) => c.id), ["b", "c", "a"]);
});

test("no match gives an empty list", () => {
  assert.deepEqual(filterCommands(commands, "xyz"), []);
});

test("highlightParts marks matched text and never alters the label", () => {
  const parts = highlightParts("Open Image Converter", "image con");
  assert.equal(parts.map((p) => p.text).join(""), "Open Image Converter");
  assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), ["Image", "Con"]);
});

test("highlightParts with an empty query marks nothing", () => {
  assert.deepEqual(highlightParts("Toggle theme", ""), [{ text: "Toggle theme", match: false }]);
  assert.deepEqual(highlightParts("<b>x</b>", "x").map((p) => p.text).join(""), "<b>x</b>");
});
