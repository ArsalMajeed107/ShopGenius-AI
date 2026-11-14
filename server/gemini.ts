import { GoogleGenAI, Type } from "@google/genai";
import type { FunctionDeclaration, Content } from "@google/genai";
import { db } from "./db.ts";
import { queryProducts, getProductByIdOrSlug } from "./catalog.ts";
import type { ProductDTO } from "./catalog.ts";

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function logAIUsage(userId: number | null | undefined, feature: string, queryPreview: string, startMs: number): void {
  try {
    db.prepare(
      "INSERT INTO ai_usage_logs (user_id, feature, query_preview, latency_ms) VALUES (?, ?, ?, ?)"
    ).run(userId ?? null, feature, queryPreview.slice(0, 140), Date.now() - startMs);
  } catch {
    // Non-blocking telemetry
  }
}

export interface SmartSearchResult {
  intentSummary: string;
  extractedFilters: {
    query?: string;
    category?: string;
    brand?: string;
    maxPrice?: number;
    minPrice?: number;
    minRating?: number;
    sortBy?: "relevance" | "price_asc" | "price_desc" | "rating" | "popularity";
  };
  products: ProductDTO[];
}

export async function runSmartSearch(naturalQuery: string, userId?: number | null): Promise<SmartSearchResult> {
  const start = Date.now();
  const ai = getAIClient();

  const categories = (db.prepare("SELECT name, slug FROM categories").all() as { name: string; slug: string }[])
    .map((c) => c.name)
    .join(", ");
  const brands = (db.prepare("SELECT name FROM brands").all() as { name: string }[])
    .map((b) => b.name)
    .join(", ");

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: `Parse this shopping search query into structured catalog filters: "${naturalQuery}"`,
    config: {
      systemInstruction:
        `You are the search query parser for ShopGenius AI. Available categories: ${categories}. Available brands: ${brands}. ` +
        `Extract concise keywords (remove filler words like 'best', 'find me', 'recommend'), budget bounds (maxPrice/minPrice), category, brand, and sort preference. ` +
        `Write a concise 1-sentence intentSummary explaining what you understood.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intentSummary: { type: Type.STRING },
          keywords: { type: Type.STRING, description: "Search keywords like 'gaming laptop', 'camera', 'wireless headphones', 'ML'" },
          category: { type: Type.STRING, description: "Exact category name or empty string" },
          brand: { type: Type.STRING, description: "Exact brand name or empty string" },
          maxPrice: { type: Type.NUMBER, description: "Maximum price in USD or 0 if unspecified" },
          minPrice: { type: Type.NUMBER, description: "Minimum price in USD or 0 if unspecified" },
          minRating: { type: Type.NUMBER, description: "Minimum rating 0-5" },
          sortBy: {
            type: Type.STRING,
            description: "One of: relevance, price_asc, price_desc, rating, popularity",
          },
        },
        required: ["intentSummary", "keywords", "sortBy"],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as {
    intentSummary?: string;
    keywords?: string;
    category?: string;
    brand?: string;
    maxPrice?: number;
    minPrice?: number;
    minRating?: number;
    sortBy?: string;
  };

  const validSort = ["relevance", "price_asc", "price_desc", "rating", "popularity"].includes(parsed.sortBy || "")
    ? (parsed.sortBy as "relevance" | "price_asc" | "price_desc" | "rating" | "popularity")
    : "relevance";

  const extractedFilters = {
    query: parsed.keywords || undefined,
    category: parsed.category || undefined,
    brand: parsed.brand || undefined,
    maxPrice: parsed.maxPrice && parsed.maxPrice > 0 ? parsed.maxPrice : undefined,
    minPrice: parsed.minPrice && parsed.minPrice > 0 ? parsed.minPrice : undefined,
    minRating: parsed.minRating && parsed.minRating > 0 ? parsed.minRating : undefined,
    sortBy: validSort,
  };

  let products = queryProducts(extractedFilters);
  if (products.length === 0 && extractedFilters.query) {
    // Broaden by category/budget if exact keyword match returned 0
    products = queryProducts({
      category: extractedFilters.category,
      maxPrice: extractedFilters.maxPrice,
      sortBy: validSort,
    });
  }

  logAIUsage(userId, "smart_search", naturalQuery, start);

  return {
    intentSummary: parsed.intentSummary || `Showing matches for "${naturalQuery}"`,
    extractedFilters,
    products,
  };
}

export interface ReviewAnalysisDTO {
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

export async function analyzeProductReviews(productId: number, forceRefresh = false, userId?: number | null): Promise<ReviewAnalysisDTO> {
  if (!forceRefresh) {
    const cached = db.prepare("SELECT * FROM review_analyses WHERE product_id = ?").get(productId) as Record<string, unknown> | undefined;
    if (cached) {
      return {
        product_id: productId,
        overall_sentiment: String(cached.overall_sentiment),
        sentiment_score: Number(cached.sentiment_score),
        positive_feedback: JSON.parse(String(cached.positive_feedback_json)),
        negative_feedback: JSON.parse(String(cached.negative_feedback_json)),
        common_complaints: JSON.parse(String(cached.common_complaints_json)),
        strengths: JSON.parse(String(cached.strengths_json)),
        weaknesses: JSON.parse(String(cached.weaknesses_json)),
        frequently_mentioned_features: JSON.parse(String(cached.features_json)),
        summary: String(cached.summary),
        updated_at: String(cached.updated_at),
      };
    }
  }

  const product = getProductByIdOrSlug(productId);
  if (!product) {
    throw new Error("Product not found");
  }
  if (!product.reviews || product.reviews.length === 0) {
    return {
      product_id: productId,
      overall_sentiment: "No Reviews Yet",
      sentiment_score: 0,
      positive_feedback: [],
      negative_feedback: [],
      common_complaints: [],
      strengths: [],
      weaknesses: [],
      frequently_mentioned_features: [],
      summary: "No customer reviews have been submitted for this product yet.",
      updated_at: new Date().toISOString(),
    };
  }

  const start = Date.now();
  const ai = getAIClient();

  const reviewsText = product.reviews
    .map((r) => `- Rating ${r.rating}/5 | "${r.title}": ${r.comment}`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: `Analyze these verified customer reviews for "${product.name}":\n${reviewsText}`,
    config: {
      systemInstruction:
        "You are an objective e-commerce review analyst. Synthesize ONLY what customers wrote in the provided reviews. Never invent facts outside the reviews. Return concise, factual bullet arrays and a balanced 2-sentence summary.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallSentiment: { type: Type.STRING, description: "e.g., Strongly Positive, Positive, Mixed, Critical" },
          sentimentScore: { type: Type.INTEGER, description: "0 to 100 aggregate satisfaction score based on reviews" },
          positiveFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
          negativeFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
          commonComplaints: { type: Type.ARRAY, items: { type: Type.STRING } },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          frequentlyMentionedFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
        },
        required: [
          "overallSentiment",
          "sentimentScore",
          "positiveFeedback",
          "negativeFeedback",
          "commonComplaints",
          "strengths",
          "weaknesses",
          "frequentlyMentionedFeatures",
          "summary",
        ],
      },
    },
  });

  const data = JSON.parse((response.text ?? "{}").trim()) as {
    overallSentiment: string;
    sentimentScore: number;
    positiveFeedback: string[];
    negativeFeedback: string[];
    commonComplaints: string[];
    strengths: string[];
    weaknesses: string[];
    frequentlyMentionedFeatures: string[];
    summary: string;
  };

  db.prepare(
    `INSERT INTO review_analyses (product_id, overall_sentiment, sentiment_score, positive_feedback_json, negative_feedback_json, common_complaints_json, strengths_json, weaknesses_json, features_json, summary, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(product_id) DO UPDATE SET
       overall_sentiment = excluded.overall_sentiment,
       sentiment_score = excluded.sentiment_score,
       positive_feedback_json = excluded.positive_feedback_json,
       negative_feedback_json = excluded.negative_feedback_json,
       common_complaints_json = excluded.common_complaints_json,
       strengths_json = excluded.strengths_json,
       weaknesses_json = excluded.weaknesses_json,
       features_json = excluded.features_json,
       summary = excluded.summary,
       updated_at = datetime('now')`
  ).run(
    productId,
    data.overallSentiment,
    data.sentimentScore,
    JSON.stringify(data.positiveFeedback),
    JSON.stringify(data.negativeFeedback),
    JSON.stringify(data.commonComplaints),
    JSON.stringify(data.strengths),
    JSON.stringify(data.weaknesses),
    JSON.stringify(data.frequentlyMentionedFeatures),
    data.summary
  );

  logAIUsage(userId, "review_analysis", product.name, start);

  return {
    product_id: productId,
    overall_sentiment: data.overallSentiment,
    sentiment_score: data.sentimentScore,
    positive_feedback: data.positiveFeedback,
    negative_feedback: data.negativeFeedback,
    common_complaints: data.commonComplaints,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    frequently_mentioned_features: data.frequentlyMentionedFeatures,
    summary: data.summary,
    updated_at: new Date().toISOString(),
  };
}

const searchCatalogTool: FunctionDeclaration = {
  name: "search_catalog_products",
  description:
    "Search the ShopGenius backend catalog by natural keywords, category, brand, or maximum price. Always use this before recommending any product.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Search keywords e.g. 'laptop', 'camera', 'gaming', 'wireless headphones', 'ML'" },
      category: { type: Type.STRING, description: "Category name: Laptops, Smartphones, Audio, Wearables, Cameras" },
      brand: { type: Type.STRING, description: "Brand name e.g. AeroBook, VoltTech, Apple, Samsung, Sonix, Chronos, OpticCore" },
      maxPrice: { type: Type.NUMBER, description: "Maximum price in USD" },
      sortBy: { type: Type.STRING, description: "relevance | price_asc | price_desc | rating | popularity" },
    },
  },
};

const getProductDetailsTool: FunctionDeclaration = {
  name: "get_product_details_and_prices",
  description:
    "Retrieve complete specifications, verified multi-store price comparison offers, and customer reviews for a specific product ID or slug.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productIdOrSlug: { type: Type.STRING, description: "Numeric product ID or slug string" },
    },
    required: ["productIdOrSlug"],
  },
};

const compareProductsTool: FunctionDeclaration = {
  name: "compare_multiple_products",
  description: "Fetch side-by-side specifications, lowest prices, and ratings for 2 to 3 products by ID or keyword.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productIds: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER },
        description: "List of numeric product IDs to compare",
      },
    },
    required: ["productIds"],
  },
};

export interface AssistantReply {
  reply: string;
  recommendedProducts: ProductDTO[];
  followUpSuggestions: string[];
  toolSummary: string;
}

export async function runShoppingAssistant(opts: {
  conversationId: number;
  userMessage: string;
  userId?: number | null;
  productContextId?: number | null;
}): Promise<AssistantReply> {
  const start = Date.now();
  const ai = getAIClient();

  // Load recent conversation history
  const historyRows = db
    .prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 16")
    .all(opts.conversationId) as { role: string; content: string }[];

  let preferenceContext = "No saved user preferences yet.";
  if (opts.userId) {
    const pref = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(opts.userId) as Record<string, unknown> | undefined;
    if (pref) {
      preferenceContext = `User interests: ${pref.interests_json}; Preferred categories: ${pref.preferred_categories_json}; Budget cap: $${pref.max_budget}; Learned keywords: ${pref.learned_keywords_json}`;
    }
  }

  let productContextText = "";
  if (opts.productContextId) {
    const ctxProd = getProductByIdOrSlug(opts.productContextId);
    if (ctxProd) {
      productContextText = `\nCurrent product on screen: [ID ${ctxProd.id}] ${ctxProd.name} ($${ctxProd.lowest_price}, ${ctxProd.rating}/5).`;
    }
  }

  const contents: Content[] = historyRows.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({
    role: "user",
    parts: [{ text: opts.userMessage }],
  });

  const systemInstruction =
    `You are ShopGenius AI, an intelligent personal shopping assistant. ` +
    `CRITICAL GROUNDING RULE: You MUST retrieve real products, prices, store offers, and reviews exclusively by calling the provided catalog tools. NEVER invent product names, prices, discounts, store names, or specifications. ` +
    `All catalog data is from the ShopGenius Demonstration Catalog; when citing store prices, mention the lowest price and store accurately. ` +
    `Keep recommendations crisp, structured, and helpful, explaining WHY each recommended item fits the user's request. ` +
    `End with 2-3 natural follow-up questions the user might ask next.\n` +
    `Customer Preference Context: ${preferenceContext}${productContextText}`;

  const recommendedIds = new Set<number>();
  const toolsUsed: string[] = [];

  let currentContents = [...contents];
  let finalReplyText = "";

  // Up to 3 tool-calling rounds
  for (let round = 0; round < 3; round++) {
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: currentContents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [searchCatalogTool, getProductDetailsTool, compareProductsTool] }],
      },
    });

    const fnCalls = response.functionCalls;
    const candidateContent = response.candidates?.[0]?.content;

    if (!fnCalls || fnCalls.length === 0) {
      finalReplyText = (response.text ?? "").trim();
      break;
    }

    if (candidateContent) {
      currentContents.push(candidateContent);
    }

    const functionResponses = fnCalls.map((call) => {
      toolsUsed.push(call.name || "tool");
      let resultData: unknown = {};
      const args = (call.args || {}) as Record<string, unknown>;

      if (call.name === "search_catalog_products") {
        const found = queryProducts({
          query: args.query ? String(args.query) : undefined,
          category: args.category ? String(args.category) : undefined,
          brand: args.brand ? String(args.brand) : undefined,
          maxPrice: args.maxPrice ? Number(args.maxPrice) : undefined,
          sortBy: args.sortBy as "relevance" | "price_asc" | "price_desc" | "rating" | "popularity" | undefined,
          limit: 6,
        });
        for (const p of found) recommendedIds.add(p.id);
        resultData = {
          count: found.length,
          products: found.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand_name,
            category: p.category_name,
            lowest_price: p.lowest_price,
            base_price: p.base_price,
            highest_discount: p.highest_discount,
            rating: p.rating,
            review_count: p.review_count,
            in_stock: p.in_stock,
            specs: p.specs,
            description: p.description,
          })),
        };
      } else if (call.name === "get_product_details_and_prices") {
        const prod = getProductByIdOrSlug(String(args.productIdOrSlug || ""));
        if (prod) {
          recommendedIds.add(prod.id);
          resultData = {
            id: prod.id,
            name: prod.name,
            brand: prod.brand_name,
            lowest_price: prod.lowest_price,
            rating: prod.rating,
            specs: prod.specs,
            offers: prod.offers,
            reviews: prod.reviews.slice(0, 5),
          };
        } else {
          resultData = { error: "Product not found in catalog." };
        }
      } else if (call.name === "compare_multiple_products") {
        const ids = Array.isArray(args.productIds) ? args.productIds.map(Number) : [];
        const items = ids
          .map((id) => getProductByIdOrSlug(id))
          .filter((p): p is NonNullable<ReturnType<typeof getProductByIdOrSlug>> => Boolean(p));
        for (const p of items) recommendedIds.add(p.id);
        resultData = items.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand_name,
          lowest_price: p.lowest_price,
          rating: p.rating,
          specs: p.specs,
          lowest_offer: p.offers.find((o) => o.is_lowest) || p.offers[0],
        }));
      }

      return {
        functionResponse: {
          id: call.id,
          name: call.name || "",
          response: { result: resultData },
        },
      };
    });

    currentContents.push({
      role: "user",
      parts: functionResponses,
    });
  }

  if (!finalReplyText) {
    finalReplyText = "I checked our catalog for matching options. Let me know if you want to refine by budget, brand, or key specs.";
  }

  // Learn preference keywords if logged in
  if (opts.userId) {
    learnPreferencesFromQuery(opts.userId, opts.userMessage);
  }

  const allMatchingProducts = Array.from(recommendedIds)
    .map((id) => queryProducts({}).find((p) => p.id === id))
    .filter((p): p is ProductDTO => Boolean(p))
    .slice(0, 4);

  const followUpSuggestions = buildContextualFollowUps(opts.userMessage, allMatchingProducts);

  logAIUsage(opts.userId, "shopping_assistant", opts.userMessage, start);

  return {
    reply: finalReplyText,
    recommendedProducts: allMatchingProducts,
    followUpSuggestions,
    toolSummary: toolsUsed.length > 0 ? `Catalog tools consulted: ${Array.from(new Set(toolsUsed)).join(", ")}` : "",
  };
}

function learnPreferencesFromQuery(userId: number, query: string): void {
  try {
    const pref = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
    if (!pref) return;

    const keywords: string[] = JSON.parse(String(pref.learned_keywords_json || "[]"));
    const cats: string[] = JSON.parse(String(pref.preferred_categories_json || "[]"));
    const lower = query.toLowerCase();

    const categoryHints: Record<string, string> = {
      laptop: "Laptops",
      notebook: "Laptops",
      phone: "Smartphones",
      iphone: "Smartphones",
      samsung: "Smartphones",
      headphone: "Audio",
      earbud: "Audio",
      watch: "Wearables",
      camera: "Cameras",
    };

    for (const [hint, cat] of Object.entries(categoryHints)) {
      if (lower.includes(hint) && !cats.includes(cat)) {
        cats.push(cat);
      }
    }

    const budgetMatch = lower.match(/under\s*\$?(\d{2,4})/);
    let maxBudget = Number(pref.max_budget || 2500);
    if (budgetMatch) {
      maxBudget = Number(budgetMatch[1]);
    }

    const extracted = query
      .toLowerCase()
      .replace(/[^\w\s$]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["find", "show", "best", "with", "this", "that", "what", "compare", "recommend", "suggest"].includes(w))
      .slice(0, 3);

    for (const kw of extracted) {
      if (!keywords.includes(kw)) keywords.unshift(kw);
    }

    db.prepare(
      `UPDATE user_preferences
       SET preferred_categories_json = ?, max_budget = ?, learned_keywords_json = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(JSON.stringify(cats.slice(0, 6)), maxBudget, JSON.stringify(keywords.slice(0, 12)), userId);
  } catch {
    // Non-critical preference update
  }
}

function buildContextualFollowUps(query: string, products: ProductDTO[]): string[] {
  if (products.length >= 2) {
    return [
      `Compare ${products[0].name} and ${products[1].name} specs`,
      `Which store has the lowest verified price for ${products[0].name}?`,
      `Summarize customer pros and cons for ${products[0].name}`,
    ];
  }
  if (products.length === 1) {
    return [
      `Analyze customer reviews for ${products[0].name}`,
      `Find cheaper alternatives to ${products[0].name}`,
      `Compare store prices and shipping for ${products[0].name}`,
    ];
  }
  if (query.toLowerCase().includes("laptop")) {
    return ["Show laptops under $800", "Compare gaming vs workstation laptops", "Which laptop has the longest battery?"];
  }
  return ["Find me the best laptop under $800", "Compare iPhone and Samsung smartphones", "Find affordable wireless headphones"];
}
