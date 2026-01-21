/** Shopify product types to exclude (accessories, gifts, etc.). */
export const TYPE_DENY_LIST = [
  "Accessories",
  "Books",
  "gifts",
  "Gifts",
  "Teaware",
  "Event Tickets",
  "gift-card-product",
  "Bits and Bites",
  "Snacks",
  "Teaware > Tea Pot",
] as const;

/** Shopify product tags to exclude (teaware, gift cards, etc.). */
export const TAGS_DENY_LIST = [
  "gift",
  "gifts",
  "Chasaku",
  "Chashaku",
  "Chasen",
  "Sifter",
  "GIST_GIFT_CARD",
  "Treats",
  "Tea Pots",
  "Tea Cups",
  "Chawan",
] as const;

/** Substrings in product titles to exclude (samplers, filters, etc.). */
export const TITLE_DENY_LIST = [
  " oz",
  "Sampler Set",
  "Tea Filters",
  "Tea Tray",
  "Whisk",
  "Gift Card",
  " Mug ",
  "Bowl",
] as const;

/** Vendors to exclude (non-tea specialty items). */
export const VENDOR_DENY_LIST = [
  "Douglas Sweets",
  "The Home Pantry",
  "Urban Tokyo",
] as const;
