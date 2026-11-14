import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Brand, Category, Product, Store, User } from "../types";
import { apiRequest } from "../lib/api";

interface AdminViewProps {
  user: User | null;
  onCatalogMutated: () => void;
}

interface AdminOverview {
  analytics: {
    totalUsers: number;
    totalProducts: number;
    totalReviews: number;
    totalOrders: number;
    totalSearches: number;
    aiFeatureStats: { feature: string; count: number; avg_latency_ms: number }[];
  };
  users: { id: number; name: string; email: string; role: string; email_verified: number; created_at: string }[];
  products: Product[];
  categories: Category[];
  brands: Brand[];
  stores: Store[];
  offers: {
    id: number;
    product_id: number;
    product_name: string;
    store_name: string;
    current_price: number;
    previous_price: number | null;
    availability: string;
  }[];
  reviews: { id: number; product_name: string; author_name: string; rating: number; title: string; created_at: string }[];
  announcements: { id: number; title: string; body: string; active: number }[];
  aiLogs: { id: number; feature: string; query_preview: string; latency_ms: number; created_at: string }[];
}

export function AdminView({ user, onCatalogMutated }: AdminViewProps) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<"analytics" | "products" | "prices" | "users" | "announcements">("analytics");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Add Product Form
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("499");
  const [prodStock, setProdStock] = useState("20");
  const [prodCat, setProdCat] = useState<number>(1);
  const [prodBrand, setProdBrand] = useState<number>(1);
  const [prodDesc, setProdDesc] = useState("");
  const [prodImgKey, setProdImgKey] = useState("laptop_pro");

  // Announcement Form
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  // New Category / Store
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");

  const loadAdmin = async () => {
    try {
      const res = await apiRequest<AdminOverview>("/api/admin/overview");
      setData(res);
      if (res.categories.length > 0 && !prodCat) setProdCat(res.categories[0].id);
      if (res.brands.length > 0 && !prodBrand) setProdBrand(res.brands[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin console.");
    }
  };

  useEffect(() => {
    if (user?.role === "admin") loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-3">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Administrator Access Required
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sign in with an administrator account (e.g., admin@shopgenius.ai) to manage products, offers, users, and AI analytics.
        </p>
      </div>
    );
  }

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    setNotice("");
    await apiRequest("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        name: prodName,
        basePrice: Number(prodPrice),
        stockCount: Number(prodStock),
        categoryId: prodCat,
        brandId: prodBrand,
        description: prodDesc,
        imageKey: prodImgKey,
      }),
    });
    setProdName("");
    setProdDesc("");
    setNotice("Product added to catalog.");
    loadAdmin();
    onCatalogMutated();
  };

  const handleDeleteProduct = async (id: number) => {
    await apiRequest(`/api/admin/products/${id}`, { method: "DELETE" });
    loadAdmin();
    onCatalogMutated();
  };

  const handleUpdateOffer = async (offerId: number, currentPrice: number, availability: string) => {
    await apiRequest(`/api/admin/prices/${offerId}`, {
      method: "PATCH",
      body: JSON.stringify({ currentPrice, availability }),
    });
    setNotice("Store price updated and verified.");
    loadAdmin();
    onCatalogMutated();
  };

  const handleRoleToggle = async (uid: number, currentRole: string) => {
    const nextRole = currentRole === "admin" ? "customer" : "admin";
    await apiRequest(`/api/admin/users/${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ role: nextRole }),
    });
    loadAdmin();
  };

  const handleDeleteReview = async (id: number) => {
    await apiRequest(`/api/admin/reviews/${id}`, { method: "DELETE" });
    loadAdmin();
    onCatalogMutated();
  };

  const handleAddAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    await apiRequest("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify({ title: annTitle, body: annBody }),
    });
    setAnnTitle("");
    setAnnBody("");
    loadAdmin();
    onCatalogMutated();
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    await apiRequest("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: newCat }) });
    setNewCat("");
    loadAdmin();
    onCatalogMutated();
  };

  const handleAddBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim()) return;
    await apiRequest("/api/admin/brands", { method: "POST", body: JSON.stringify({ name: newBrand }) });
    setNewBrand("");
    loadAdmin();
    onCatalogMutated();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Admin Console
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage catalog inventory, store prices, customer reviews, user accounts, and AI telemetry.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {[
            { id: "analytics", label: "Analytics & AI" },
            { id: "products", label: "Products & Taxonomies" },
            { id: "prices", label: "Store Prices" },
            { id: "users", label: "Users & Reviews" },
            { id: "announcements", label: "Announcements" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                tab === t.id
                  ? "bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {data && tab === "analytics" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 tabular-nums">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Registered Users</p>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.analytics.totalUsers}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Catalog Products</p>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.analytics.totalProducts}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Customer Reviews</p>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.analytics.totalReviews}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Searches Logged</p>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.analytics.totalSearches}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
              <p className="text-xs text-slate-500">Orders Reserved</p>
              <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{data.analytics.totalOrders}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                AI Feature Usage Statistics
              </h2>
              {data.analytics.aiFeatureStats.length === 0 ? (
                <p className="text-xs text-slate-500">No AI queries recorded yet.</p>
              ) : (
                <table className="w-full text-xs text-left tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2">Feature</th>
                      <th className="py-2">Calls</th>
                      <th className="py-2 text-right">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.analytics.aiFeatureStats.map((s) => (
                      <tr key={s.feature}>
                        <td className="py-2.5 font-medium text-slate-900 dark:text-white">{s.feature}</td>
                        <td className="py-2.5 font-mono">{s.count}</td>
                        <td className="py-2.5 font-mono text-right">{s.avg_latency_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Recent AI Request Log
              </h2>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.aiLogs.map((l) => (
                  <div key={l.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{l.query_preview || l.feature}</p>
                      <p className="text-slate-500">{l.feature}</p>
                    </div>
                    <span className="font-mono text-slate-500 shrink-0 tabular-nums">{l.latency_ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {data && tab === "products" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleAddProduct}
            className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3.5"
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Add Catalog Product</span>
            </h2>
            <input
              type="text"
              required
              placeholder="Product Name"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={prodCat}
                onChange={(e) => setProdCat(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={prodBrand}
                onChange={(e) => setProdBrand(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                {data.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="number"
                required
                placeholder="Price ($)"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
              />
              <input
                type="number"
                required
                placeholder="Stock"
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
              />
            </div>
            <select
              value={prodImgKey}
              onChange={(e) => setProdImgKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            >
              <option value="laptop_pro">Studio Ultrabook Image</option>
              <option value="gaming_laptop">Performance Laptop Image</option>
              <option value="smartphone">Flagship Smartphone Image</option>
              <option value="headphones">Over-Ear Headphones Image</option>
              <option value="earbuds">Wireless Earbuds Image</option>
              <option value="watch">Titanium Smartwatch Image</option>
              <option value="camera">Mirrorless Camera Image</option>
            </select>
            <textarea
              rows={3}
              placeholder="Product description..."
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium cursor-pointer"
            >
              Add Product
            </button>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Category"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Brand"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddBrand}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Base Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{p.name}</td>
                    <td className="py-3 px-4 text-slate-500">{p.category_name}</td>
                    <td className="py-3 px-4 font-mono">${p.base_price}</td>
                    <td className="py-3 px-4 font-mono">{p.stock_count}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && tab === "prices" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Store Source</th>
                <th className="py-3 px-4">Current Price ($)</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.offers.map((o) => (
                <tr key={o.id}>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{o.product_name}</td>
                  <td className="py-3 px-4 text-slate-500">{o.store_name}</td>
                  <td className="py-3 px-4 font-mono">${o.current_price}</td>
                  <td className="py-3 px-4">{o.availability}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateOffer(o.id, Math.max(19, o.current_price - 20), o.availability)}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer"
                    >
                      -$20 Promo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateOffer(o.id, o.current_price, o.availability === "In Stock" ? "Low Stock" : "In Stock")
                      }
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer"
                    >
                      Toggle Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Registered Users</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data.users.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                    <p className="text-slate-500">{u.email} · {u.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRoleToggle(u.id, u.role)}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer"
                  >
                    Switch Role
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Review Moderation</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-96 overflow-y-auto">
              {data.reviews.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {r.title} ({r.rating}/5)
                    </p>
                    <p className="text-slate-500">
                      {r.product_name} · by {r.author_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteReview(r.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data && tab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleAddAnnouncement}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3"
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Publish Storefront Announcement
            </h2>
            <input
              type="text"
              required
              placeholder="Announcement Title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
            <textarea
              required
              rows={3}
              placeholder="Message body..."
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium cursor-pointer"
            >
              Publish Announcement
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Active Announcements</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data.announcements.map((a) => (
                <div key={a.id} className="py-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                  <p className="text-slate-500 mt-0.5">{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
