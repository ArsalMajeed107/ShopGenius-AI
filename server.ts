import "dotenv/config";
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { db, initDatabase } from "./server/db.ts";
import { attachAuth, requireAuth, requireAdmin, signToken } from "./server/auth.ts";
import type { AuthedRequest } from "./server/auth.ts";
import { queryProducts, getProductByIdOrSlug, getPersonalizedRecommendations } from "./server/catalog.ts";
import { runSmartSearch, analyzeProductReviews, runShoppingAssistant } from "./server/gemini.ts";

initDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));
app.use(attachAuth);

function getOrCreateCartId(userId?: number | null, sessionId?: string): number {
  if (userId) {
    const existing = db.prepare("SELECT id FROM shopping_carts WHERE user_id = ?").get(userId) as { id: number } | undefined;
    if (existing) return existing.id;
    const res = db.prepare("INSERT INTO shopping_carts (user_id, session_id) VALUES (?, ?)").run(userId, sessionId || null);
    return Number(res.lastInsertRowid);
  }
  const sid = sessionId || "guest-default";
  const existing = db.prepare("SELECT id FROM shopping_carts WHERE session_id = ? AND user_id IS NULL").get(sid) as { id: number } | undefined;
  if (existing) return existing.id;
  const res = db.prepare("INSERT INTO shopping_carts (session_id) VALUES (?)").run(sid);
  return Number(res.lastInsertRowid);
}

function getCartPayload(userId?: number | null, sessionId?: string) {
  const cartId = getOrCreateCartId(userId, sessionId);
  const rows = db
    .prepare(
      `SELECT ci.id as item_id, ci.product_id, ci.quantity, ci.saved_for_later, ci.selected_store_id,
              p.name, p.slug, p.image_key, p.base_price, p.in_stock, p.stock_count,
              b.name as brand_name, c.name as category_name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       JOIN brands b ON p.brand_id = b.id
       JOIN categories c ON p.category_id = c.id
       WHERE ci.cart_id = ?
       ORDER BY ci.added_at DESC`
    )
    .all(cartId) as Record<string, unknown>[];

  const items = rows.map((r) => {
    const productId = Number(r.product_id);
    const offer = r.selected_store_id
      ? (db
          .prepare(
            `SELECT pp.*, s.name as store_name FROM product_prices pp JOIN stores s ON pp.store_id = s.id
             WHERE pp.product_id = ? AND pp.store_id = ?`
          )
          .get(productId, Number(r.selected_store_id)) as Record<string, unknown> | undefined)
      : (db
          .prepare(
            `SELECT pp.*, s.name as store_name FROM product_prices pp JOIN stores s ON pp.store_id = s.id
             WHERE pp.product_id = ? ORDER BY (pp.current_price + pp.shipping_cost) ASC LIMIT 1`
          )
          .get(productId) as Record<string, unknown> | undefined);

    const unitPrice = offer ? Number(offer.current_price) : Number(r.base_price);
    const previousPrice = offer && offer.previous_price ? Number(offer.previous_price) : Number(r.base_price);
    const shippingCost = offer ? Number(offer.shipping_cost) : 0;

    return {
      item_id: Number(r.item_id),
      product_id: productId,
      name: String(r.name),
      slug: String(r.slug),
      image_key: String(r.image_key),
      brand_name: String(r.brand_name),
      category_name: String(r.category_name),
      quantity: Number(r.quantity),
      saved_for_later: Number(r.saved_for_later) === 1,
      store_id: offer ? Number(offer.store_id) : null,
      store_name: offer ? String(offer.store_name) : "ShopGenius Direct (Demo)",
      unit_price: unitPrice,
      previous_price: previousPrice > unitPrice ? previousPrice : null,
      shipping_cost: shippingCost,
      in_stock: Number(r.in_stock) === 1,
    };
  });

  const activeItems = items.filter((i) => !i.saved_for_later);
  const savedItems = items.filter((i) => i.saved_for_later);
  const subtotal = activeItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const discountTotal = activeItems.reduce((sum, i) => {
    const prev = i.previous_price ? i.previous_price : i.unit_price;
    return sum + Math.max(0, prev - i.unit_price) * i.quantity;
  }, 0);
  const shippingTotal = activeItems.reduce((sum, i) => sum + i.shipping_cost, 0);
  const total = subtotal + shippingTotal;

  return {
    cartId,
    activeItems,
    savedItems,
    count: activeItems.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: Number(subtotal.toFixed(2)),
    discountTotal: Number(discountTotal.toFixed(2)),
    shippingTotal: Number(shippingTotal.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "ShopGenius AI" });
});

// Catalog Meta
app.get("/api/catalog/meta", (_req, res) => {
  const categories = db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
  const brands = db.prepare("SELECT * FROM brands ORDER BY name ASC").all();
  const stores = db.prepare("SELECT * FROM stores ORDER BY id ASC").all();
  const announcements = db.prepare("SELECT * FROM announcements WHERE active = 1 ORDER BY id DESC").all();
  res.json({ categories, brands, stores, announcements });
});

// Products Listing & Filtering
app.get("/api/products", (req: AuthedRequest, res) => {
  const q = req.query.q ? String(req.query.q) : undefined;
  const category = req.query.category ? String(req.query.category) : undefined;
  const brand = req.query.brand ? String(req.query.brand) : undefined;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
  const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
  const inStockOnly = req.query.inStockOnly === "true";
  const sortBy = (req.query.sortBy ? String(req.query.sortBy) : "popularity") as
    | "relevance"
    | "price_asc"
    | "price_desc"
    | "rating"
    | "popularity";

  if (q && q.trim()) {
    db.prepare(
      "INSERT INTO search_history (user_id, session_id, query, filters_json) VALUES (?, ?, ?, ?)"
    ).run(req.user?.id ?? null, req.sessionId || null, q.trim(), JSON.stringify({ category, brand, maxPrice }));
  }

  const products = queryProducts({
    query: q,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    inStockOnly,
    sortBy,
  });

  res.json({ products, total: products.length });
});

// Product Details
app.get("/api/products/:idOrSlug", (req: AuthedRequest, res) => {
  const product = getProductByIdOrSlug(String(req.params.idOrSlug));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  db.prepare("INSERT INTO browsing_history (user_id, session_id, product_id) VALUES (?, ?, ?)").run(
    req.user?.id ?? null,
    req.sessionId || null,
    product.id
  );

  const cachedAnalysis = db.prepare("SELECT * FROM review_analyses WHERE product_id = ?").get(product.id) as Record<string, unknown> | undefined;
  let reviewAnalysis = null;
  if (cachedAnalysis) {
    reviewAnalysis = {
      product_id: product.id,
      overall_sentiment: String(cachedAnalysis.overall_sentiment),
      sentiment_score: Number(cachedAnalysis.sentiment_score),
      positive_feedback: JSON.parse(String(cachedAnalysis.positive_feedback_json)),
      negative_feedback: JSON.parse(String(cachedAnalysis.negative_feedback_json)),
      common_complaints: JSON.parse(String(cachedAnalysis.common_complaints_json)),
      strengths: JSON.parse(String(cachedAnalysis.strengths_json)),
      weaknesses: JSON.parse(String(cachedAnalysis.weaknesses_json)),
      frequently_mentioned_features: JSON.parse(String(cachedAnalysis.features_json)),
      summary: String(cachedAnalysis.summary),
      updated_at: String(cachedAnalysis.updated_at),
    };
  }

  res.json({ product, reviewAnalysis });
});

// Add Customer Review
app.post("/api/products/:id/reviews", (req: AuthedRequest, res) => {
  const productId = Number(req.params.id);
  const { authorName, rating, title, comment } = req.body as {
    authorName?: string;
    rating?: number;
    title?: string;
    comment?: string;
  };

  if (!rating || rating < 1 || rating > 5 || !title?.trim() || !comment?.trim()) {
    res.status(400).json({ error: "Rating (1-5), title, and review comment are required." });
    return;
  }

  const name = req.user?.name || authorName?.trim() || "Verified Shopper";
  db.prepare(
    "INSERT INTO reviews (product_id, user_id, author_name, rating, title, comment, verified_purchase) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(productId, req.user?.id ?? null, name, Math.round(rating), title.trim(), comment.trim(), req.user ? 1 : 0);

  const stats = db.prepare("SELECT AVG(rating) as avg_r, COUNT(*) as cnt FROM reviews WHERE product_id = ?").get(productId) as {
    avg_r: number;
    cnt: number;
  };
  db.prepare("UPDATE products SET rating = ?, review_count = ? WHERE id = ?").run(
    Number(stats.avg_r.toFixed(1)),
    stats.cnt,
    productId
  );
  // Invalidate cached AI review analysis so next analysis includes the new review
  db.prepare("DELETE FROM review_analyses WHERE product_id = ?").run(productId);

  const updated = getProductByIdOrSlug(productId);
  res.json({ reviews: updated?.reviews || [], rating: updated?.rating, review_count: updated?.review_count });
});

// Personalized Recommendations
app.get("/api/recommendations", (req: AuthedRequest, res) => {
  const recs = getPersonalizedRecommendations(req.user?.id, req.sessionId);
  res.json(recs);
});

// Product Comparison
app.post("/api/compare", (req: AuthedRequest, res) => {
  const { productIds, saveTitle } = req.body as { productIds?: number[]; saveTitle?: string };
  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ error: "Select at least one product to compare." });
    return;
  }
  const products = productIds
    .slice(0, 3)
    .map((id) => getProductByIdOrSlug(id))
    .filter((p): p is NonNullable<ReturnType<typeof getProductByIdOrSlug>> => Boolean(p));

  if (saveTitle && req.user) {
    db.prepare("INSERT INTO saved_comparisons (user_id, title, product_ids_json) VALUES (?, ?, ?)").run(
      req.user.id,
      saveTitle.trim(),
      JSON.stringify(products.map((p) => p.id))
    );
  }

  res.json({ products });
});

// AI Smart Search
app.post("/api/ai/smart-search", async (req: AuthedRequest, res) => {
  try {
    const { query } = req.body as { query?: string };
    if (!query || !query.trim()) {
      res.status(400).json({ error: "Please enter a search query." });
      return;
    }

    db.prepare("INSERT INTO search_history (user_id, session_id, query, filters_json) VALUES (?, ?, ?, ?)").run(
      req.user?.id ?? null,
      req.sessionId || null,
      query.trim(),
      JSON.stringify({ mode: "ai_smart_search" })
    );

    const result = await runSmartSearch(query.trim(), req.user?.id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI Smart Search failed.";
    res.status(500).json({ error: message });
  }
});

// AI Review Analyzer
app.post("/api/ai/analyze-reviews/:id", async (req: AuthedRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const force = req.body?.force === true;
    const analysis = await analyzeProductReviews(productId, force, req.user?.id);
    res.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to analyze product reviews.";
    res.status(500).json({ error: message });
  }
});

// AI Conversations & Chat
app.get("/api/ai/conversations", (req: AuthedRequest, res) => {
  const rows = req.user
    ? db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 20").all(req.user.id)
    : db
        .prepare("SELECT * FROM conversations WHERE session_id = ? AND user_id IS NULL ORDER BY updated_at DESC, id DESC LIMIT 20")
        .all(req.sessionId || "");
  res.json({ conversations: rows });
});

app.post("/api/ai/conversations", (req: AuthedRequest, res) => {
  const { title } = req.body as { title?: string };
  const result = db
    .prepare("INSERT INTO conversations (user_id, session_id, title) VALUES (?, ?, ?)")
    .run(req.user?.id ?? null, req.sessionId || null, title?.trim() || "Shopping Session");
  const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(Number(result.lastInsertRowid));
  res.json({ conversation: conv });
});

app.get("/api/ai/conversations/:id/messages", (req: AuthedRequest, res) => {
  const convId = Number(req.params.id);
  const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC").all(convId) as Record<string, unknown>[];
  const allProducts = queryProducts({});
  const messages = rows.map((m) => {
    const prodIds: number[] = JSON.parse(String(m.recommended_product_ids_json || "[]"));
    const products = prodIds
      .map((id) => allProducts.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return {
      id: Number(m.id),
      role: String(m.role),
      content: String(m.content),
      products,
      toolSummary: String(m.tool_summary || ""),
      created_at: String(m.created_at),
    };
  });
  res.json({ messages });
});

app.delete("/api/ai/conversations/:id", (req: AuthedRequest, res) => {
  const convId = Number(req.params.id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(convId);
  res.json({ ok: true });
});

app.post("/api/ai/chat", async (req: AuthedRequest, res) => {
  try {
    const { conversationId, message, productContextId } = req.body as {
      conversationId?: number;
      message?: string;
      productContextId?: number;
    };
    if (!message || !message.trim()) {
      res.status(400).json({ error: "Please enter a message for the AI assistant." });
      return;
    }

    let convId = conversationId;
    if (!convId) {
      const title = message.trim().slice(0, 48);
      const created = db
        .prepare("INSERT INTO conversations (user_id, session_id, title) VALUES (?, ?, ?)")
        .run(req.user?.id ?? null, req.sessionId || null, title);
      convId = Number(created.lastInsertRowid);
    } else {
      const msgCount = (db.prepare("SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?").get(convId) as { c: number }).c;
      if (msgCount === 0) {
        db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?").run(
          message.trim().slice(0, 48),
          convId
        );
      } else {
        db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
      }
    }

    const replyData = await runShoppingAssistant({
      conversationId: convId,
      userMessage: message.trim(),
      userId: req.user?.id,
      productContextId,
    });

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content, recommended_product_ids_json) VALUES (?, 'user', ?, '[]')"
    ).run(convId, message.trim());

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content, recommended_product_ids_json, tool_summary) VALUES (?, 'assistant', ?, ?, ?)"
    ).run(
      convId,
      replyData.reply,
      JSON.stringify(replyData.recommendedProducts.map((p) => p.id)),
      replyData.toolSummary
    );

    res.json({
      conversationId: convId,
      reply: replyData.reply,
      products: replyData.recommendedProducts,
      followUpSuggestions: replyData.followUpSuggestions,
      toolSummary: replyData.toolSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI Assistant request failed.";
    res.status(500).json({ error: message });
  }
});

// Authentication Routes
app.post("/api/auth/register", (req: AuthedRequest, res) => {
  const { name, email, password, avatarUrl } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    avatarUrl?: string;
  };
  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    res.status(400).json({ error: "Name, valid email, and password (min 6 characters) are required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomBytes(16).toString("hex");
  const result = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, avatar_url, email_verified, verification_token) VALUES (?, ?, ?, 'customer', ?, 0, ?)"
    )
    .run(name.trim(), normalizedEmail, passwordHash, avatarUrl?.trim() || "", verificationToken);

  const userId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO user_preferences (user_id, interests_json, preferred_categories_json, preferred_brands_json, min_budget, max_budget, learned_keywords_json)
     VALUES (?, '[]', '[]', '[]', 0, 2000, '[]')`
  ).run(userId);

  db.prepare(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'info', 'Welcome to ShopGenius AI', 'Verify your email or customize your shopping preferences in your dashboard.')"
  ).run(userId);

  const token = signToken({ userId, role: "customer" });
  res.cookie("sg_token", token, { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7, path: "/" });

  const user = db.prepare("SELECT id, name, email, role, avatar_url, email_verified FROM users WHERE id = ?").get(userId);
  res.json({ user, token, verificationToken });
});

app.post("/api/auth/login", (req: AuthedRequest, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;
  if (!userRow || !bcrypt.compareSync(password, String(userRow.password_hash))) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  // Merge guest cart into user cart if guest cart has items
  if (req.sessionId) {
    const guestCart = db
      .prepare("SELECT id FROM shopping_carts WHERE session_id = ? AND user_id IS NULL")
      .get(req.sessionId) as { id: number } | undefined;
    if (guestCart) {
      const userCartId = getOrCreateCartId(Number(userRow.id), req.sessionId);
      const guestItems = db.prepare("SELECT * FROM cart_items WHERE cart_id = ?").all(guestCart.id) as Record<string, unknown>[];
      for (const gi of guestItems) {
        const exists = db
          .prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND saved_for_later = ?")
          .get(userCartId, Number(gi.product_id), Number(gi.saved_for_later)) as { id: number; quantity: number } | undefined;
        if (exists) {
          db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(exists.quantity + Number(gi.quantity), exists.id);
        } else {
          db.prepare(
            "INSERT INTO cart_items (cart_id, product_id, quantity, saved_for_later, selected_store_id) VALUES (?, ?, ?, ?, ?)"
          ).run(
            userCartId,
            Number(gi.product_id),
            Number(gi.quantity),
            Number(gi.saved_for_later),
            gi.selected_store_id !== null && gi.selected_store_id !== undefined ? Number(gi.selected_store_id) : null
          );
        }
      }
      db.prepare("DELETE FROM shopping_carts WHERE id = ?").run(guestCart.id);
    }
  }

  const token = signToken({ userId: Number(userRow.id), role: String(userRow.role) });
  res.cookie("sg_token", token, { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7, path: "/" });

  res.json({
    user: {
      id: Number(userRow.id),
      name: String(userRow.name),
      email: String(userRow.email),
      role: String(userRow.role),
      avatar_url: String(userRow.avatar_url || ""),
      email_verified: Number(userRow.email_verified),
    },
    token,
  });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("sg_token", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", (req: AuthedRequest, res) => {
  res.json({ user: req.user || null });
});

app.patch("/api/auth/profile", requireAuth, (req: AuthedRequest, res) => {
  const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Name cannot be empty." });
    return;
  }
  db.prepare("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?").run(name.trim(), avatarUrl?.trim() || "", req.user!.id);
  const updated = db.prepare("SELECT id, name, email, role, avatar_url, email_verified FROM users WHERE id = ?").get(req.user!.id);
  res.json({ user: updated });
});

app.post("/api/auth/verify-email", (req: AuthedRequest, res) => {
  const { token } = req.body as { token?: string };
  if (token) {
    const user = db.prepare("SELECT id FROM users WHERE verification_token = ?").get(token) as { id: number } | undefined;
    if (!user) {
      res.status(400).json({ error: "Invalid verification token." });
      return;
    }
    db.prepare("UPDATE users SET email_verified = 1, verification_token = '' WHERE id = ?").run(user.id);
    res.json({ ok: true });
    return;
  }
  if (req.user) {
    db.prepare("UPDATE users SET email_verified = 1, verification_token = '' WHERE id = ?").run(req.user.id);
    res.json({ ok: true });
    return;
  }
  res.status(400).json({ error: "Verification token required." });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "Email address is required." });
    return;
  }
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase()) as { id: number } | undefined;
  if (!user) {
    res.json({ message: "If an account exists for that email, a reset token has been generated." });
    return;
  }
  const resetToken = crypto.randomBytes(6).toString("hex").toUpperCase();
  const expires = Date.now() + 1000 * 60 * 30;
  db.prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?").run(resetToken, expires, user.id);
  res.json({
    message: "Password reset code generated for local verification.",
    demoResetToken: resetToken,
  });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { email, token, newPassword } = req.body as { email?: string; token?: string; newPassword?: string };
  if (!email?.trim() || !token?.trim() || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Email, reset code, and new password (min 6 chars) are required." });
    return;
  }
  const user = db.prepare("SELECT id, reset_token, reset_expires FROM users WHERE email = ?").get(email.trim().toLowerCase()) as
    | { id: number; reset_token: string; reset_expires: number }
    | undefined;
  if (!user || user.reset_token !== token.trim().toUpperCase() || user.reset_expires < Date.now()) {
    res.status(400).json({ error: "Invalid or expired reset code." });
    return;
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, reset_token = '', reset_expires = 0 WHERE id = ?").run(hash, user.id);
  res.json({ ok: true, message: "Password updated successfully. You can now sign in." });
});

// Cart Routes
app.get("/api/cart", (req: AuthedRequest, res) => {
  res.json(getCartPayload(req.user?.id, req.sessionId));
});

app.post("/api/cart/items", (req: AuthedRequest, res) => {
  const { productId, quantity = 1, storeId } = req.body as { productId?: number; quantity?: number; storeId?: number };
  if (!productId) {
    res.status(400).json({ error: "productId is required." });
    return;
  }
  const cartId = getOrCreateCartId(req.user?.id, req.sessionId);
  const existing = db
    .prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND saved_for_later = 0")
    .get(cartId, productId) as { id: number; quantity: number } | undefined;

  if (existing) {
    db.prepare("UPDATE cart_items SET quantity = ?, selected_store_id = COALESCE(?, selected_store_id) WHERE id = ?").run(
      existing.quantity + Math.max(1, quantity),
      storeId ?? null,
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO cart_items (cart_id, product_id, quantity, saved_for_later, selected_store_id) VALUES (?, ?, ?, 0, ?)"
    ).run(cartId, productId, Math.max(1, quantity), storeId ?? null);
  }
  db.prepare("UPDATE shopping_carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);
  res.json(getCartPayload(req.user?.id, req.sessionId));
});

app.patch("/api/cart/items/:itemId", (req: AuthedRequest, res) => {
  const itemId = Number(req.params.itemId);
  const { quantity, savedForLater } = req.body as { quantity?: number; savedForLater?: boolean };
  if (quantity !== undefined) {
    if (quantity <= 0) {
      db.prepare("DELETE FROM cart_items WHERE id = ?").run(itemId);
    } else {
      db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(quantity, itemId);
    }
  }
  if (savedForLater !== undefined) {
    db.prepare("UPDATE cart_items SET saved_for_later = ? WHERE id = ?").run(savedForLater ? 1 : 0, itemId);
  }
  res.json(getCartPayload(req.user?.id, req.sessionId));
});

app.delete("/api/cart/items/:itemId", (req: AuthedRequest, res) => {
  const itemId = Number(req.params.itemId);
  db.prepare("DELETE FROM cart_items WHERE id = ?").run(itemId);
  res.json(getCartPayload(req.user?.id, req.sessionId));
});

// Checkout (honest Demo Reservation — never claims real external card payment)
app.post("/api/orders/checkout", (req: AuthedRequest, res) => {
  const { customerName, customerEmail, shippingAddress, paymentMethod } = req.body as {
    customerName?: string;
    customerEmail?: string;
    shippingAddress?: string;
    paymentMethod?: string;
  };

  if (!customerName?.trim() || !customerEmail?.trim() || !shippingAddress?.trim()) {
    res.status(400).json({ error: "Full name, email, and shipping address are required." });
    return;
  }

  const cart = getCartPayload(req.user?.id, req.sessionId);
  if (cart.activeItems.length === 0) {
    res.status(400).json({ error: "Your shopping cart is empty." });
    return;
  }

  const orderNumber = `SG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  db.prepare(
    `INSERT INTO orders (order_number, user_id, session_id, customer_name, customer_email, shipping_address, items_json, subtotal, discount_total, shipping_total, total, payment_method, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Demo Order Reserved (No Payment Charged)')`
  ).run(
    orderNumber,
    req.user?.id ?? null,
    req.sessionId || null,
    customerName.trim(),
    customerEmail.trim(),
    shippingAddress.trim(),
    JSON.stringify(cart.activeItems),
    cart.subtotal,
    cart.discountTotal,
    cart.shippingTotal,
    cart.total,
    paymentMethod || "Demo Checkout Reservation"
  );

  for (const item of cart.activeItems) {
    db.prepare("UPDATE products SET stock_count = MAX(0, stock_count - ?) WHERE id = ?").run(item.quantity, item.product_id);
  }
  db.prepare("DELETE FROM cart_items WHERE cart_id = ? AND saved_for_later = 0").run(cart.cartId);

  if (req.user) {
    db.prepare(
      "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'order', ?, ?)"
    ).run(
      req.user.id,
      `Order ${orderNumber} Reserved`,
      `Demo reservation recorded for ${cart.count} item(s) totaling $${cart.total.toFixed(2)}.`
    );
  }

  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
  res.json({ order, cart: getCartPayload(req.user?.id, req.sessionId) });
});

app.get("/api/orders", (req: AuthedRequest, res) => {
  const rows = req.user
    ? db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id)
    : db.prepare("SELECT * FROM orders WHERE session_id = ? ORDER BY created_at DESC").all(req.sessionId || "");
  res.json({ orders: rows });
});

// Wishlist
app.get("/api/wishlist", requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, p.name, p.slug, p.image_key, p.base_price, p.rating, b.name as brand_name, c.name as category_name
       FROM wishlists w
       JOIN products p ON w.product_id = p.id
       JOIN brands b ON p.brand_id = b.id
       JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`
    )
    .all(req.user!.id) as Record<string, unknown>[];

  const items = rows.map((r) => {
    const lowest = db
      .prepare("SELECT MIN(current_price) as min_p FROM product_prices WHERE product_id = ?")
      .get(Number(r.product_id)) as { min_p: number | null };
    return {
      ...r,
      lowest_price: lowest?.min_p ?? Number(r.base_price),
    };
  });
  res.json({ items });
});

app.post("/api/wishlist", requireAuth, (req: AuthedRequest, res) => {
  const { productId, collectionName, targetPrice } = req.body as {
    productId?: number;
    collectionName?: string;
    targetPrice?: number;
  };
  if (!productId) {
    res.status(400).json({ error: "productId is required." });
    return;
  }
  db.prepare(
    `INSERT INTO wishlists (user_id, product_id, collection_name, target_price)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, product_id) DO UPDATE SET collection_name = excluded.collection_name, target_price = excluded.target_price`
  ).run(req.user!.id, productId, collectionName?.trim() || "Saved Favorites", targetPrice ?? null);
  res.json({ ok: true });
});

app.delete("/api/wishlist/:productId", requireAuth, (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").run(req.user!.id, Number(req.params.productId));
  res.json({ ok: true });
});

// User Dashboard & Preferences
app.get("/api/dashboard", requireAuth, (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const prefRow = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(uid) as Record<string, unknown> | undefined;
  const preferences = prefRow
    ? {
        interests: JSON.parse(String(prefRow.interests_json || "[]")),
        preferredCategories: JSON.parse(String(prefRow.preferred_categories_json || "[]")),
        preferredBrands: JSON.parse(String(prefRow.preferred_brands_json || "[]")),
        minBudget: Number(prefRow.min_budget || 0),
        maxBudget: Number(prefRow.max_budget || 2500),
        learnedKeywords: JSON.parse(String(prefRow.learned_keywords_json || "[]")),
      }
    : {
        interests: [],
        preferredCategories: [],
        preferredBrands: [],
        minBudget: 0,
        maxBudget: 2500,
        learnedKeywords: [],
      };

  const wishlist = db
    .prepare(
      `SELECT w.*, p.name, p.slug, p.image_key, p.base_price, p.rating, b.name as brand_name, c.name as category_name,
              (SELECT MIN(current_price) FROM product_prices WHERE product_id = p.id) as lowest_price
       FROM wishlists w
       JOIN products p ON w.product_id = p.id
       JOIN brands b ON p.brand_id = b.id
       JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = ? ORDER BY w.created_at DESC`
    )
    .all(uid);

  const searchHistory = db
    .prepare("SELECT id, query, created_at FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 12")
    .all(uid);

  const recentIds = (
    db
      .prepare("SELECT DISTINCT product_id FROM browsing_history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 6")
      .all(uid) as { product_id: number }[]
  ).map((r) => r.product_id);
  const allProducts = queryProducts({});
  const recentlyViewed = recentIds.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean);

  const conversations = db
    .prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10")
    .all(uid);

  const savedComparisons = db
    .prepare("SELECT * FROM saved_comparisons WHERE user_id = ? ORDER BY created_at DESC LIMIT 10")
    .all(uid);

  const notifications = db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 15")
    .all(uid);

  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(uid);

  res.json({
    preferences,
    wishlist,
    searchHistory,
    recentlyViewed,
    conversations,
    savedComparisons,
    notifications,
    orders,
  });
});

app.put("/api/preferences", requireAuth, (req: AuthedRequest, res) => {
  const { interests, preferredCategories, preferredBrands, minBudget, maxBudget } = req.body as {
    interests?: string[];
    preferredCategories?: string[];
    preferredBrands?: string[];
    minBudget?: number;
    maxBudget?: number;
  };
  db.prepare(
    `INSERT INTO user_preferences (user_id, interests_json, preferred_categories_json, preferred_brands_json, min_budget, max_budget, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       interests_json = excluded.interests_json,
       preferred_categories_json = excluded.preferred_categories_json,
       preferred_brands_json = excluded.preferred_brands_json,
       min_budget = excluded.min_budget,
       max_budget = excluded.max_budget,
       updated_at = datetime('now')`
  ).run(
    req.user!.id,
    JSON.stringify(interests || []),
    JSON.stringify(preferredCategories || []),
    JSON.stringify(preferredBrands || []),
    Number(minBudget || 0),
    Number(maxBudget || 2500)
  );
  res.json({ ok: true });
});

app.post("/api/preferences/reset", requireAuth, (req: AuthedRequest, res) => {
  db.prepare(
    `UPDATE user_preferences
     SET interests_json = '[]', preferred_categories_json = '[]', preferred_brands_json = '[]',
         min_budget = 0, max_budget = 2500, learned_keywords_json = '[]', updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(req.user!.id);
  res.json({ ok: true });
});

app.patch("/api/notifications/:id/read", requireAuth, (req: AuthedRequest, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user!.id);
  res.json({ ok: true });
});

// Newsletter
app.post("/api/newsletter", (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim() || !email.includes("@")) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  db.prepare("INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)").run(email.trim().toLowerCase());
  res.json({ ok: true, message: "Subscribed to ShopGenius AI weekly product briefings." });
});

// Admin Dashboard APIs
app.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, email_verified, created_at FROM users ORDER BY id DESC")
    .all();
  const products = queryProducts({});
  const categories = db.prepare("SELECT * FROM categories ORDER BY id ASC").all();
  const brands = db.prepare("SELECT * FROM brands ORDER BY id ASC").all();
  const stores = db.prepare("SELECT * FROM stores ORDER BY id ASC").all();
  const offers = db
    .prepare(
      `SELECT pp.*, p.name as product_name, s.name as store_name
       FROM product_prices pp
       JOIN products p ON pp.product_id = p.id
       JOIN stores s ON pp.store_id = s.id
       ORDER BY pp.product_id ASC, pp.current_price ASC`
    )
    .all();
  const reviews = db
    .prepare(
      `SELECT r.*, p.name as product_name
       FROM reviews r JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC LIMIT 50`
    )
    .all();
  const announcements = db.prepare("SELECT * FROM announcements ORDER BY id DESC").all();
  const aiLogs = db.prepare("SELECT * FROM ai_usage_logs ORDER BY created_at DESC LIMIT 30").all();
  const aiFeatureStats = db
    .prepare("SELECT feature, COUNT(*) as count, ROUND(AVG(latency_ms)) as avg_latency_ms FROM ai_usage_logs GROUP BY feature")
    .all();
  const ordersCount = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number }).c;
  const searchesCount = (db.prepare("SELECT COUNT(*) as c FROM search_history").get() as { c: number }).c;

  res.json({
    analytics: {
      totalUsers: users.length,
      totalProducts: products.length,
      totalReviews: reviews.length,
      totalOrders: ordersCount,
      totalSearches: searchesCount,
      aiFeatureStats,
    },
    users,
    products,
    categories,
    brands,
    stores,
    offers,
    reviews,
    announcements,
    aiLogs,
  });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { name, sku, categoryId, brandId, description, basePrice, stockCount, imageKey, specs } = req.body as {
    name?: string;
    sku?: string;
    categoryId?: number;
    brandId?: number;
    description?: string;
    basePrice?: number;
    stockCount?: number;
    imageKey?: string;
    specs?: Record<string, string>;
  };

  if (!name?.trim() || !categoryId || !brandId || !basePrice) {
    res.status(400).json({ error: "Product name, category, brand, and price are required." });
    return;
  }

  const slug = `${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
  const finalSku = sku?.trim() || `SG-ADM-${Date.now().toString().slice(-5)}`;

  const result = db
    .prepare(
      `INSERT INTO products (sku, name, slug, category_id, brand_id, description, specs_json, image_key, gallery_keys_json, base_price, rating, review_count, popularity_score, in_stock, stock_count, is_featured, is_trending, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.7, 0, 75, 1, ?, 1, 0, 1)`
    )
    .run(
      finalSku,
      name.trim(),
      slug,
      Number(categoryId),
      Number(brandId),
      description?.trim() || "Newly added catalog product.",
      JSON.stringify(specs || { Category: "Flagship", Warranty: "1 Year" }),
      imageKey || "laptop_pro",
      JSON.stringify([imageKey || "laptop_pro"]),
      Number(basePrice),
      Number(stockCount ?? 20)
    );

  const newId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO product_prices (product_id, store_id, current_price, previous_price, discount_percent, shipping_cost, availability, product_url)
     VALUES (?, 1, ?, ?, 0, 0, 'In Stock', ?)`
  ).run(newId, Number(basePrice), null, `https://demo.shopgenius.ai/offers/${slug}`);

  res.json({ product: getProductByIdOrSlug(newId) });
});

app.patch("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, basePrice, stockCount, isFeatured, isTrending, description } = req.body as {
    name?: string;
    basePrice?: number;
    stockCount?: number;
    isFeatured?: boolean;
    isTrending?: boolean;
    description?: string;
  };
  const current = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!current) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  db.prepare(
    `UPDATE products
     SET name = ?, base_price = ?, stock_count = ?, in_stock = ?, is_featured = ?, is_trending = ?, description = ?
     WHERE id = ?`
  ).run(
    name?.trim() || String(current.name),
    basePrice !== undefined ? Number(basePrice) : Number(current.base_price),
    stockCount !== undefined ? Number(stockCount) : Number(current.stock_count),
    (stockCount !== undefined ? Number(stockCount) : Number(current.stock_count)) > 0 ? 1 : 0,
    isFeatured !== undefined ? (isFeatured ? 1 : 0) : Number(current.is_featured),
    isTrending !== undefined ? (isTrending ? 1 : 0) : Number(current.is_trending),
    description?.trim() || String(current.description),
    id
  );

  res.json({ product: getProductByIdOrSlug(id) });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Category name is required." });
    return;
  }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)").run(name.trim(), slug, description?.trim() || "");
  res.json({ categories: db.prepare("SELECT * FROM categories ORDER BY id ASC").all() });
});

app.post("/api/admin/brands", requireAdmin, (req, res) => {
  const { name, country } = req.body as { name?: string; country?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Brand name is required." });
    return;
  }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  db.prepare("INSERT INTO brands (name, slug, country) VALUES (?, ?, ?)").run(name.trim(), slug, country?.trim() || "");
  res.json({ brands: db.prepare("SELECT * FROM brands ORDER BY id ASC").all() });
});

app.post("/api/admin/stores", requireAdmin, (req, res) => {
  const { name, domain, shippingPolicy } = req.body as { name?: string; domain?: string; shippingPolicy?: string };
  if (!name?.trim() || !domain?.trim()) {
    res.status(400).json({ error: "Store name and domain are required." });
    return;
  }
  db.prepare("INSERT INTO stores (name, domain, shipping_policy, is_demo_source) VALUES (?, ?, ?, 1)").run(
    name.trim(),
    domain.trim(),
    shippingPolicy?.trim() || "Standard shipping"
  );
  res.json({ stores: db.prepare("SELECT * FROM stores ORDER BY id ASC").all() });
});

app.patch("/api/admin/prices/:offerId", requireAdmin, (req, res) => {
  const offerId = Number(req.params.offerId);
  const { currentPrice, availability } = req.body as { currentPrice?: number; availability?: string };
  const row = db.prepare("SELECT * FROM product_prices WHERE id = ?").get(offerId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: "Price offer not found." });
    return;
  }
  const newPrice = currentPrice !== undefined ? Number(currentPrice) : Number(row.current_price);
  const prevPrice = Number(row.current_price) !== newPrice ? Number(row.current_price) : (row.previous_price as number | null);
  const disc = prevPrice && prevPrice > newPrice ? Math.round(((prevPrice - newPrice) / prevPrice) * 100) : 0;

  db.prepare(
    "UPDATE product_prices SET current_price = ?, previous_price = ?, discount_percent = ?, availability = ?, last_verified_at = datetime('now') WHERE id = ?"
  ).run(newPrice, prevPrice, disc, availability || String(row.availability), offerId);

  res.json({ ok: true });
});

app.patch("/api/admin/users/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body as { role?: string };
  if (!role || !["customer", "admin"].includes(role)) {
    res.status(400).json({ error: "Valid role required." });
    return;
  }
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  res.json({ ok: true });
});

app.delete("/api/admin/reviews/:id", requireAdmin, (req, res) => {
  const rev = db.prepare("SELECT product_id FROM reviews WHERE id = ?").get(Number(req.params.id)) as { product_id: number } | undefined;
  db.prepare("DELETE FROM reviews WHERE id = ?").run(Number(req.params.id));
  if (rev) {
    const stats = db.prepare("SELECT COALESCE(AVG(rating), 4.5) as avg_r, COUNT(*) as cnt FROM reviews WHERE product_id = ?").get(rev.product_id) as {
      avg_r: number;
      cnt: number;
    };
    db.prepare("UPDATE products SET rating = ?, review_count = ? WHERE id = ?").run(
      Number(stats.avg_r.toFixed(1)),
      stats.cnt,
      rev.product_id
    );
    db.prepare("DELETE FROM review_analyses WHERE product_id = ?").run(rev.product_id);
  }
  res.json({ ok: true });
});

app.post("/api/admin/announcements", requireAdmin, (req, res) => {
  const { title, body } = req.body as { title?: string; body?: string };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Title and message body required." });
    return;
  }
  db.prepare("INSERT INTO announcements (title, body, active) VALUES (?, ?, 1)").run(title.trim(), body.trim());
  res.json({ announcements: db.prepare("SELECT * FROM announcements ORDER BY id DESC").all() });
});

app.patch("/api/admin/announcements/:id", requireAdmin, (req, res) => {
  const { active } = req.body as { active?: boolean };
  db.prepare("UPDATE announcements SET active = ? WHERE id = ?").run(active ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

// Vite / Static Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ShopGenius AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
