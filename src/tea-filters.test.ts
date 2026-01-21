import { assertEquals, assertArrayIncludes } from "@std/assert";
import {
  TYPE_DENY_LIST,
  TAGS_DENY_LIST,
  TITLE_DENY_LIST,
  VENDOR_DENY_LIST,
} from "./tea-filters.ts";

Deno.test("TYPE_DENY_LIST contains expected non-tea product types", () => {
  assertArrayIncludes([...TYPE_DENY_LIST], ["Accessories", "Teaware", "Books"]);
});

Deno.test("TAGS_DENY_LIST contains expected non-tea tags", () => {
  assertArrayIncludes([...TAGS_DENY_LIST], ["gift", "Treats", "Tea Pots"]);
});

Deno.test("TITLE_DENY_LIST contains expected non-tea title patterns", () => {
  assertArrayIncludes([...TITLE_DENY_LIST], ["Gift Card", "Whisk", "Bowl"]);
});

Deno.test("VENDOR_DENY_LIST contains expected non-tea vendors", () => {
  assertArrayIncludes([...VENDOR_DENY_LIST], ["Douglas Sweets"]);
});

Deno.test("all deny lists are readonly arrays", () => {
  // These should be readonly arrays (compile-time check)
  const _typeList: readonly string[] = TYPE_DENY_LIST;
  const _tagsList: readonly string[] = TAGS_DENY_LIST;
  const _titleList: readonly string[] = TITLE_DENY_LIST;
  const _vendorList: readonly string[] = VENDOR_DENY_LIST;

  assertEquals(Array.isArray(TYPE_DENY_LIST), true);
  assertEquals(Array.isArray(TAGS_DENY_LIST), true);
  assertEquals(Array.isArray(TITLE_DENY_LIST), true);
  assertEquals(Array.isArray(VENDOR_DENY_LIST), true);
});
