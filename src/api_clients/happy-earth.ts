import { htmlToMarkdown } from "../format.ts";
import { getAllProducts, Product, productHasTag } from "./shopify.ts";

const BASE_URL = "https://happyearthtea.com";

function getThumbnail(product: Product): string | null {
  const variants = product.variants;
  if (variants) {
    const variantWithSource = variants?.find((variant: any) =>
      variant.featured_image?.src
    );
    if (variantWithSource) {
      return variantWithSource.featured_image.src;
    }
  }
  return null;
}

function isAvailable(product: Product): boolean {
  return Boolean(product.variants?.at(0).available);
}

function filterTeas(products: Product[]): Product[] {
  const TYPE_DENY_LIST = [
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
  ];
  const TAGS_DENY_LIST = [
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
  ];
  const TITLE_DENY_LIST = [
    " oz",
    "Sampler Set",
    "Tea Filters",
    "Tea Tray",
    "Whisk",
    "Gift Card",
  ];
  const VENDOR_DENY_LIST = [
    "Douglas Sweets",
    "The Home Pantry",
  ];

  return products
    .filter((product) =>
      !TITLE_DENY_LIST.some((title) => product.title?.includes(title))
    )
    .filter((product) =>
      !TAGS_DENY_LIST.some((tag) => productHasTag(product, tag))
    ).filter((product) =>
      !TYPE_DENY_LIST.some((type) => product.product_type === type)
    ).filter((product) =>
      !VENDOR_DENY_LIST.some((vendor) => product.vendor === vendor)
    );
}

export type Tea = {
  title: string;
  description: string;
  thumbnail: string | null;
  available: boolean;
  productType: string | null;
};

export async function getTeas(): Promise<Tea[]> {
  const allProducts = await getAllProducts(BASE_URL);
  const teas = filterTeas(allProducts);
  return teas.map((tea) => ({
    title: tea.title || "",
    description: htmlToMarkdown(tea.body_html || ""),
    thumbnail: getThumbnail(tea),
    available: isAvailable(tea),
    productType: tea.product_type,
  }));
}
