export interface User {
  id: number;
  name: string;
  email: string;
  role: "customer" | "admin";
  avatar_url: string;
  email_verified: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  country: string;
}

export interface Store {
  id: number;
  name: string;
  domain: string;
  trust_rating: number;
  shipping_policy: string;
  is_demo_source: number;
}

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

export interface Review {
  id: number;
  product_id: number;
  user_id: number | null;
  author_name: string;
  rating: number;
  title: string;
  comment: string;
  verified_purchase: number;
  created_at: string;
}

export interface Product {
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
  reviews?: Review[];
  similar?: Product[];
  recommendation_reason?: string;
}

export interface ReviewAnalysis {
  product_id: number;
  overall_sentiment: string;
  sentiment_score: number;
  positive_feedback: string[];
  negative_feedback: string[];
  common_complaints: string[];
  strengths: string[];
  weaknesses: string[];
  frequently_mentioned_features: string[];
  summary: string;
  updated_at: string;
}

export interface CartItem {
  item_id: number;
  product_id: number;
  name: string;
  slug: string;
  image_key: string;
  brand_name: string;
  category_name: string;
  quantity: number;
  saved_for_later: boolean;
  store_id: number | null;
  store_name: string;
  unit_price: number;
  previous_price: number | null;
  shipping_cost: number;
  in_stock: boolean;
}

export interface CartPayload {
  cartId: number;
  activeItems: CartItem[];
  savedItems: CartItem[];
  count: number;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  followUpSuggestions?: string[];
  toolSummary?: string;
  created_at: string;
}

export interface UserPreferences {
  interests: string[];
  preferredCategories: string[];
  preferredBrands: string[];
  minBudget: number;
  maxBudget: number;
  learnedKeywords: string[];
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  active: number;
  created_at: string;
}

export type AppView = "home" | "catalog" | "product" | "assistant" | "compare" | "dashboard" | "admin";
