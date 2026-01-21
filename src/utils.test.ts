import { assertEquals } from "@std/assert";
import { truncate } from "./utils.ts";

Deno.test("truncate - returns original string when under max length", () => {
  const result = truncate("Hello world", 20);
  assertEquals(result, "Hello world");
});

Deno.test("truncate - truncates and adds ellipsis when over max length", () => {
  const result = truncate("Hello world this is a long string", 10);
  assertEquals(result, "Hello worl...");
});

Deno.test("truncate - normalizes whitespace", () => {
  const result = truncate("Hello    world\n\ntest", 50);
  assertEquals(result, "Hello world test");
});

Deno.test("truncate - handles empty string", () => {
  const result = truncate("", 10);
  assertEquals(result, "");
});

Deno.test("truncate - handles string exactly at max length", () => {
  const result = truncate("Hello", 5);
  assertEquals(result, "Hello");
});

Deno.test("truncate - trims leading and trailing whitespace", () => {
  const result = truncate("  Hello world  ", 50);
  assertEquals(result, "Hello world");
});
