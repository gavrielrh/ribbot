import { Schema } from "effect";

export class Image extends Schema.Class<Image>("Image")({
  created_at: Schema.NullOr(Schema.String),
  height: Schema.NullOr(Schema.Number),
  id: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(Schema.Number),
  product_id: Schema.NullOr(Schema.Number),
  src: Schema.NullOr(Schema.String),
  updated_at: Schema.NullOr(Schema.String),
  variant_ids: Schema.NullOr(Schema.Array(Schema.Number)),
  width: Schema.NullOr(Schema.Number),
}) {}

export class FeaturedImage extends Schema.Class<FeaturedImage>("FeaturedImage")({
  src: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
}) {}

export class Variant extends Schema.Class<Variant>("Variant")({
  barcode: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  compare_at_price: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  created_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  fulfillment_service: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  grams: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  id: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  image_id: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  inventory_item_id: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  inventory_management: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  inventory_policy: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  inventory_quantity: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  old_inventory_quantity: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  position: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  price: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  product_id: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  requires_shipping: Schema.optionalWith(Schema.NullOr(Schema.Boolean), { default: () => null }),
  sku: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  tax_code: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  taxable: Schema.optionalWith(Schema.NullOr(Schema.Boolean), { default: () => null }),
  title: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  updated_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  weight: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  weight_unit: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  featured_image: Schema.optionalWith(Schema.NullOr(FeaturedImage), { default: () => null }),
  available: Schema.optionalWith(Schema.NullOr(Schema.Boolean), { default: () => null }),
}) {}

export class Product extends Schema.Class<Product>("Product")({
  title: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  body_html: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  created_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  handle: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  id: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
  product_type: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  published_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  published_scope: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  status: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  tags: Schema.optionalWith(Schema.NullOr(Schema.Union(Schema.String, Schema.Array(Schema.String))), { default: () => null }),
  template_suffix: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  updated_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  variants: Schema.optionalWith(Schema.NullOr(Schema.Array(Variant)), { default: () => null }),
  vendor: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
}) {}

export class ProductsResponse extends Schema.Class<ProductsResponse>("ProductsResponse")({
  products: Schema.Array(Product),
}) {}

export const decodeProductsResponse = Schema.decodeUnknown(ProductsResponse);
