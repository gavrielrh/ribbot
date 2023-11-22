import { htmlToMarkdown } from "../format.ts";

type Image = {
  created_at: string | null;
  height: number | null;
  id: number | null;
  position: number | null;
  product_id: number | null;
  src: string | null;
  updated_at: string | null;
  variant_ids: number[] | null;
  width: number | null;
};

type Variant = {
  barcode: string | null;
  compare_at_price: string | null;
  created_at: string | null;
  fulfillment_service: string | null;
  grams: number | null;
  id: number | null;
  image_id: number | null;
  inventory_item_id: number | null;
  inventory_management: string | null;
  inventory_policy: string | null;
  inventory_quantity: number | null;
  old_inventory_quantity: number | null;
  option: { [key: string]: unknown } | null;
  position: number | null;
  presentment_prices: { [key: string]: unknown }[] | null;
  price: string | null;
  product_id: number | null;
  requires_shipping: boolean | null;
  sku: string | null;
  tax_code: string | null;
  taxable: boolean | null;
  title: string | null;
  updated_at: string | null;
  weight: number | null;
  weight_unit: string | null;
};

type Product = {
  title: string | null;
  body_html: string | null;
  created_at: string | null;
  handle: string | null;
  id: number | null;
  images: Image[] | null | { [key: string]: any };
  options: { [key: string]: unknown } | { [key: string]: unknown }[] | null;
  product_type: string | null;
  published_at: string | null;
  published_scope: string | null;
  status: string | null;
  tags: string | string[] | null;
  template_suffix: string | null;
  updated_at: string | null;
  variants: Variant[] | null | { [key: string]: any };
  vendor: string | null;
};

const BASE_URL = "https://happyearthtea.com";
const MAX_PRODUCTS_PER_PAGE = 250;

async function getProducts(page = 1): Promise<Product[]> {
  const data = await fetch(
    `${BASE_URL}/products.json?page=${page}&limit=${MAX_PRODUCTS_PER_PAGE}`,
  );
  const json = await data.json();
  return json.products;
}

async function getAllProducts(): Promise<Product[]> {
  const allProducts: Product[] = [];
  let page = 1;
  const MAX_PAGES = 100;
  while (page < MAX_PAGES) {
    const products = await getProducts(page);
    if (products.length === 0) break;
    allProducts.push(...products);
    page += 1;
  }
  return allProducts;
}

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

function productHasTag(product: Product, tag: string): boolean {
  if (!product.tags) {
    return false;
  }
  if (product.tags instanceof String) {
    return product.tags.includes(tag);
  }
  if (product.tags instanceof Array) {
    return product.tags.some((productTag) => productTag === tag);
  }
  return false;
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
  ];
  const TAGS_DENY_LIST = [
    "gift",
    "gifts",
    "Chasaku",
    "Chashaku",
    "Chasen",
    "Sifter",
    "GIST_GIFT_CARD",
  ];
  const TITLE_DENY_LIST = [
    " oz",
    "Sampler Set",
    "Tea Filters",
    "Tea Tray",
    "Whisk",
    "Gift Card",
  ];

  return products
    .filter((product) =>
      !TITLE_DENY_LIST.some((title) => product.title?.includes(title))
    )
    .filter((product) =>
      !TAGS_DENY_LIST.some((tag) => productHasTag(product, tag))
    )
    .filter((product) =>
      !TYPE_DENY_LIST.some((type) => product.product_type === type)
    );
}

export type Tea = {
  title: string;
  description: string;
  thumbnail: string | null;
  available: boolean;
};

export async function getTeas(): Promise<Tea[]> {
  const allProducts = await getAllProducts();
  const teas = filterTeas(allProducts);
  return teas.map((tea) => ({
    title: tea.title || "",
    description: htmlToMarkdown(tea.body_html || ""),
    thumbnail: getThumbnail(tea),
    available: isAvailable(tea),
  }));
}

export async function saveTeasToStore(teas: Tea[]) {
  const kv = await Deno.openKv();
  for await (const tea of teas) {
    await kv.set(["tea", tea.title.toLowerCase()], tea);
  }
}
