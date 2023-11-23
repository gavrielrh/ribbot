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
  const expected = "text\n";
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

Deno.test("converts em tag", () => {
  const given = "<em>text</em>";
  const expected = "_text_";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts div tag", () => {
  const given = "<div>text</div>";
  const expected = "text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts ul tag", () => {
  const given = "<ul>text</ul>";
  const expected = "text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("converts li tag", () => {
  const given = "<li>text</li>";
  const expected = "\n- text";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("removes empty tags", () => {
  const given = "<foo></foo>";
  const expected = "";
  assertEquals(htmlToMarkdown(given), expected);
});

Deno.test("removes extra newlines", () => {
  const given = "\n\n\n\n\nfoo";
  const expected = "\n\nfoo";
  assertEquals(htmlToMarkdown(given), expected);
});
