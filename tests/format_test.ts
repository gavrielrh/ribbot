import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { htmlToMarkdown } from "../src/format.ts";

Deno.test("converts h tag", () => {
  const given = "<h2>text</h2>";
  const expected = "**text**";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts p tag", () => {
  const given = "<p>text</p>";
  const expected = "\ntext\n";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts span tag", () => {
  const given = "<span>text</span>";
  const expected = "text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts img tag", () => {
  const given = "<img>text</img>";
  const expected = "text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts meta tag", () => {
  const given = "<meta>text</meta>";
  const expected = "text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts br tag", () => {
  const given = "<br>text";
  const expected = "\ntext";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts nbsp tag", () => {
  const given = "nbsp;text";
  const expected = " text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts anchor tag", () => {
  const given = "<a href='https://google.com'>google</a>";
  const expected = "[google](https://google.com)";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts iframe tag", () => {
  const given = "<iframe>text</iframe>";
  const expected = "text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts strong tag", () => {
  const given = "<strong>text</strong>";
  const expected = "**text**";
  assertEquals(htmlToMarkdown(given), expected);
});
