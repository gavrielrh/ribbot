export type Image = {
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

export type Variant = {
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

export type Product = {
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

const MAX_PRODUCTS_PER_PAGE = 250;

export async function getProducts(
  baseUrl: string,
  page = 1,
): Promise<Product[]> {
  const data = await fetch(
    `${baseUrl}/products.json?page=${page}&limit=${MAX_PRODUCTS_PER_PAGE}`,
  );
  const json = await data.json();
  return json.products;
}

export async function getAllProducts(baseUrl: string): Promise<Product[]> {
  const allProducts: Product[] = [];
  let page = 1;
  const MAX_PAGES = 100;
  while (page < MAX_PAGES) {
    const products = await getProducts(baseUrl, page);
    if (products.length === 0) break;
    allProducts.push(...products);
    page += 1;
  }
  return allProducts;
}

export function productHasTag(product: Product, tag: string): boolean {
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
