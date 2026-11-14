import { db } from "./db.ts";

export interface ProductOffer {
  id: number;
  store_id: number;
  store_name: string;
  store_domain: string;
  trust_rating: number;
  shipping_policy: string;
  is_demo_source: number;
  current_price: number;
  previous_price: number | null;
  discount_percent: number;
  shipping_cost: number;
  availability: string;
  product_url: string;
  last_verified_at: string;
  is_lowest: boolean;
}

export interface ProductDTO {
  id: number;
  sku: string;
  name: string;
  slug: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  brand_id: number;
  brand_name: string;
  brand_slug: string;
  description: string;
  specs: Record<string, string>;
  image_key: string;
  gallery_keys: string[];
  base_price: number;
  lowest_price: number;
  highest_discount: number;
  rating: number;
  review_count: number;
  popularity_score: number;
  in_stock: boolean;
  stock_count: number;
  is_featured: boolean;
  is_trending: boolean;
  is_demo: boolean;
  offers?: ProductOffer[];
  recommendation_reason?: string;
}

export interface ProductSearchFilters {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "popularity";
  limit?: number;
}

function hydrateProductRow(row: Record<string, unknown>): ProductDTO {
  const prodId = Number(row.id);
  const priceStats = db
    .prepare(
      `SELECT MIN(current_price) as min_p, MAX(discount_percent) as max_d
       FROM product_prices WHERE product_id = ?`
    )
    .get(prodId) as { min_p: number | null; max_d: number | null };

  return {
    id: prodId,
    sku: String(row.sku),
    name: String(row.name),
    slug: String(row.slug),
    category_id: Number(row.category_id),
    category_name: String(row.category_name),
    category_slug: String(row.category_slug),
    brand_id: Number(row.brand_id),
    brand_name: String(row.brand_name),
    brand_slug: String(row.brand_slug),
    description: String(row.description),
    specs: JSON.parse(String(row.specs_json || "{}")),
    image_key: String(row.image_key),
    gallery_keys: JSON.parse(String(row.gallery_keys_json || "[]")),
    base_price: Number(row.base_price),
    lowest_price: priceStats?.min_p ?? Number(row.base_price),
    highest_discount: priceStats?.max_d ?? 0,
    rating: Number(row.rating),
    review_count: Number(row.review_count),
    popularity_score: Number(row.popularity_score),
    in_stock: Number(row.in_stock) === 1,
    stock_count: Number(row.stock_count),
    is_featured: Number(row.is_featured) === 1,
    is_trending: Number(row.is_trending) === 1,
    is_demo: Number(row.is_demo) === 1,
  };
}

export function queryProducts(filters: ProductSearchFilters = {}): ProductDTO[] {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.category && filters.category.toLowerCase() !== "all") {
    where.push("(LOWER(c.slug) = LOWER(?) OR LOWER(c.name) = LOWER(?))");
    params.push(filters.category, filters.category);
  }
  if (filters.brand && filters.brand.toLowerCase() !== "all") {
    where.push("(LOWER(b.slug) = LOWER(?) OR LOWER(b.name) = LOWER(?))");
    params.push(filters.brand, filters.brand);
  }
  if (filters.minRating !== undefined && filters.minRating > 0) {
    where.push("p.rating >= ?");
    params.push(filters.minRating);
  }
  if (filters.inStockOnly) {
    where.push("p.in_stock = 1 AND p.stock_count > 0");
  }

  if (filters.query && filters.query.trim()) {
    const terms = filters.query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1 && !["the", "for", "and", "with", "best", "good", "find", "show", "me", "under", "affordable"].includes(t));
    if (terms.length > 0) {
      const termClauses = terms.map(
        () => "(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.specs_json) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(b.name) LIKE ?)"
      );
      where.push(`(${termClauses.join(" OR ")})`);
      for (const term of terms) {
        const pattern = `%${term}%`;
        params.push(pattern, pattern, pattern, pattern, pattern);
      }
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN brands b ON p.brand_id = b.id
    ${whereSql}
    ORDER BY p.popularity_score DESC, p.rating DESC
  `;

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  let products = rows.map(hydrateProductRow);

  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    products = products.filter((p) => p.lowest_price >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    products = products.filter((p) => p.lowest_price <= filters.maxPrice!);
  }

  if (filters.sortBy === "price_asc") {
    products.sort((a, b) => a.lowest_price - b.lowest_price);
  } else if (filters.sortBy === "price_desc") {
    products.sort((a, b) => b.lowest_price - a.lowest_price);
  } else if (filters.sortBy === "rating") {
    products.sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
  } else if (filters.sortBy === "popularity") {
    products.sort((a, b) => b.popularity_score - a.popularity_score);
  } else if (filters.query && filters.query.trim()) {
    const q = filters.query.toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length > 1);
    products.sort((a, b) => {
      const score = (p: ProductDTO) => {
        const hay = `${p.name} ${p.brand_name} ${p.category_name} ${p.description} ${JSON.stringify(p.specs)}`.toLowerCase();
        let s = 0;
        if (p.name.toLowerCase().includes(q)) s += 10;
        for (const t of tokens) {
          if (p.name.toLowerCase().includes(t)) s += 4;
          if (hay.includes(t)) s += 2;
        }
        return s + p.popularity_score * 0.02;
      };
      return score(b) - score(a);
    });
  }

  if (filters.limit && filters.limit > 0) {
    return products.slice(0, filters.limit);
  }
  return products;
}

export function getProductByIdOrSlug(idOrSlug: string | number): (ProductDTO & { offers: ProductOffer[]; reviews: Record<string, unknown>[]; similar: ProductDTO[] }) | null {
  const row = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug
       FROM products p
       JOIN categories c ON p.category_id = c.id
       JOIN brands b ON p.brand_id = b.id
       WHERE p.id = ? OR p.slug = ?`
    )
    .get(Number(idOrSlug) || -1, String(idOrSlug)) as Record<string, unknown> | undefined;

  if (!row) return null;
  const product = hydrateProductRow(row);

  const rawOffers = db
    .prepare(
      `SELECT pp.*, s.name as store_name, s.domain as store_domain, s.trust_rating, s.shipping_policy, s.is_demo_source
       FROM product_prices pp
       JOIN stores s ON pp.store_id = s.id
       WHERE pp.product_id = ?
       ORDER BY (pp.current_price + pp.shipping_cost) ASC`
    )
    .all(product.id) as Record<string, unknown>[];

  const minTotal = rawOffers.length > 0
    ? Math.min(...rawOffers.map((o) => Number(o.current_price) + Number(o.shipping_cost)))
    : product.base_price;

  const offers: ProductOffer[] = rawOffers.map((o) => {
    const total = Number(o.current_price) + Number(o.shipping_cost);
    return {
      id: Number(o.id),
      store_id: Number(o.store_id),
      store_name: String(o.store_name),
      store_domain: String(o.store_domain),
      trust_rating: Number(o.trust_rating),
      shipping_policy: String(o.shipping_policy),
      is_demo_source: Number(o.is_demo_source),
      current_price: Number(o.current_price),
      previous_price: o.previous_price !== null ? Number(o.previous_price) : null,
      discount_percent: Number(o.discount_percent),
      shipping_cost: Number(o.shipping_cost),
      availability: String(o.availability),
      product_url: String(o.product_url),
      last_verified_at: String(o.last_verified_at),
      is_lowest: total === minTotal,
    };
  });

  const reviews = db
    .prepare(
      `SELECT id, product_id, user_id, author_name, rating, title, comment, verified_purchase, created_at
       FROM reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC`
    )
    .all(product.id) as Record<string, unknown>[];

  const similarRows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug
       FROM products p
       JOIN categories c ON p.category_id = c.id
       JOIN brands b ON p.brand_id = b.id
       WHERE p.id != ? AND (p.category_id = ? OR ABS(p.base_price - ?) < 400)
       ORDER BY (CASE WHEN p.category_id = ? THEN 1 ELSE 0 END) DESC, p.rating DESC
       LIMIT 4`
    )
    .all(product.id, product.category_id, product.base_price, product.category_id) as Record<string, unknown>[];

  const similar = similarRows.map(hydrateProductRow).map((s) => ({
    ...s,
    recommendation_reason: s.category_id === product.category_id
      ? `Same ${product.category_name} category with ${s.rating.toFixed(1)} rating`
      : `Comparable price range around $${s.lowest_price}`,
  }));

  return {
    ...product,
    offers,
    reviews,
    similar,
  };
}

export function getPersonalizedRecommendations(userId?: number | null, sessionId?: string): {
  recommendedForYou: ProductDTO[];
  trending: ProductDTO[];
  bestDeals: ProductDTO[];
  mostPopular: ProductDTO[];
  recentlyViewed: ProductDTO[];
} {
  const all = queryProducts({ sortBy: "popularity" });

  let prefCats: string[] = [];
  let prefBrands: string[] = [];
  let interests: string[] = [];
  let maxBudget = 2500;
  let recentIds: number[] = [];

  if (userId) {
    const pref = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
    if (pref) {
      prefCats = JSON.parse(String(pref.preferred_categories_json || "[]"));
      prefBrands = JSON.parse(String(pref.preferred_brands_json || "[]"));
      interests = JSON.parse(String(pref.interests_json || "[]"));
      maxBudget = Number(pref.max_budget || 2500);
    }
    const hist = db
      .prepare("SELECT DISTINCT product_id FROM browsing_history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 6")
      .all(userId) as { product_id: number }[];
    recentIds = hist.map((h) => h.product_id);
  } else if (sessionId) {
    const hist = db
      .prepare("SELECT DISTINCT product_id FROM browsing_history WHERE session_id = ? ORDER BY viewed_at DESC LIMIT 6")
      .all(sessionId) as { product_id: number }[];
    recentIds = hist.map((h) => h.product_id);
  }

  const scored = all.map((p) => {
    let score = p.popularity_score * 0.2 + p.rating * 5;
    const reasons: string[] = [];

    if (prefCats.some((c) => c.toLowerCase() === p.category_name.toLowerCase())) {
      score += 20;
      reasons.push(`Matches your interest in ${p.category_name}`);
    }
    if (prefBrands.some((b) => b.toLowerCase() === p.brand_name.toLowerCase())) {
      score += 12;
      reasons.push(`From preferred brand ${p.brand_name}`);
    }
    if (p.lowest_price <= maxBudget) {
      score += 8;
      if (reasons.length === 0) reasons.push(`Fits within your $${maxBudget} target budget`);
    }
    if (p.highest_discount >= 12) {
      score += 6;
      reasons.push(`${p.highest_discount}% verified demo discount available`);
    }
    if (interests.length > 0 && reasons.length === 0) {
      reasons.push(`Highly rated (${p.rating.toFixed(1)}/5) across ${p.review_count} verified reviews`);
    }
    if (reasons.length === 0) {
      reasons.push(`Top-rated ${p.category_name.toLowerCase()} pick with verified multi-store pricing`);
    }

    return {
      product: { ...p, recommendation_reason: reasons.slice(0, 2).join(" · ") },
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const recommendedForYou = scored.slice(0, 6).map((s) => s.product);
  const trending = all.filter((p) => p.is_trending).slice(0, 6).map((p) => ({
    ...p,
    recommendation_reason: `Trending in ${p.category_name} · ${p.popularity_score} demand index`,
  }));
  const bestDeals = [...all]
    .filter((p) => p.highest_discount > 0)
    .sort((a, b) => b.highest_discount - a.highest_discount)
    .slice(0, 6)
    .map((p) => ({
      ...p,
      recommendation_reason: `Save up to ${p.highest_discount}% across compared stores`,
    }));
  const mostPopular = [...all].slice(0, 6).map((p) => ({
    ...p,
    recommendation_reason: `${p.rating.toFixed(1)}/5 average across ${p.review_count} reviews`,
  }));
  const recentlyViewed = recentIds
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is ProductDTO => Boolean(p));

  return {
    recommendedForYou,
    trending,
    bestDeals,
    mostPopular,
    recentlyViewed,
  };
}
