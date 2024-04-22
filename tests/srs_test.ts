import { createItem, getItemsToReview, updateItem } from "../src/srs.ts";
import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";

Deno.test("End to end", () => {
  // Step 1: User adds a new item
  const newItem = createItem("Learn Deno");
  assertEquals(newItem.repetition, 0);
  assertEquals(newItem.nextInterval, 1);

  // Passage of time
  const fakeCurrentDate = new Date(newItem.lastReview);
  fakeCurrentDate.setDate(fakeCurrentDate.getDate() + 1);

  // Step 2: User reviews the item the next day.
  const reviewedItem1 = updateItem(newItem, 4); // Good recall !
  assertEquals(reviewedItem1.repetition, 1);
  assertEquals(reviewedItem1.nextInterval, 1);

  // Passage of time
  fakeCurrentDate.setDate(fakeCurrentDate.getDate() + 1); // 1 day later

  // Step 3: User reviews the item after 1 day
  const reviewedItem2 = updateItem(reviewedItem1, 3); // Moderate recall !
  assertEquals(reviewedItem2.repetition, 2);
  assertEquals(reviewedItem2.nextInterval, 6);

  // No items to review since we're not 6 days later
  const itemsToReview1 = getItemsToReview([reviewedItem2], fakeCurrentDate);
  assertEquals(itemsToReview1.length, 0);

  fakeCurrentDate.setDate(fakeCurrentDate.getDate() + 6); // 6 days later

  // Step 4: Check if the item is scheduled for review correctly
  const itemsToReview2 = getItemsToReview([reviewedItem2], fakeCurrentDate);
  assertEquals(itemsToReview2.length, 1);
  assertEquals(itemsToReview2[0].content, "Learn Deno");

  //  User fails a recall
  const reviewedItem3 = updateItem(reviewedItem1, 1); // Poor recall
  assertEquals(reviewedItem3.repetition, 0);
  assertEquals(reviewedItem3.nextInterval, 1);
});
