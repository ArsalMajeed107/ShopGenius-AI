import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { LogOut, RotateCcw, Bell, Trash2, CheckCircle2, MessageSquare } from "lucide-react";
import type { Brand, Category, Product, User, UserPreferences } from "../types";
import { apiRequest } from "../lib/api";
import { ProductCard } from "./ProductCard";

interface DashboardViewProps {
  user: User | null;
  categories: Category[];
  brands: Brand[];
  recommended: Product[];
  wishlistIds: number[];
  compareIds: number[];
  onOpenAuth: () => void;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  onAskAI: (product?: Product, prompt?: string) => void;
  onOpenCompare: (ids: number[]) => void;
}

interface DashboardData {
  preferences: UserPreferences;
  wishlist: (Product & { collection_name: string; target_price: number | null })[];
  searchHistory: { id: number; query: string; created_at: string }[];
  recentlyViewed: Product[];
  conversations: { id: number; title: string; updated_at: string }[];
  savedComparisons: { id: number; title: string; product_ids_json: string; created_at: string }[];
  notifications: { id: number; type: string; title: string; message: string; is_read: number; created_at: string }[];
  orders: { id: number; order_number: string; total: number; status: string; created_at: string }[];
}

export function DashboardView({
  user,
  categories,
  brands,
  recommended,
  wishlistIds,
  compareIds,
  onOpenAuth,
  onUserUpdated,
  onLogout,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  onToggleCompare,
  onAskAI,
  onOpenCompare,
}: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<"overview" | "preferences" | "wishlist" | "activity" | "account">("overview");
  const [loading, setLoading] = useState(false);

  // Preferences state
  const [interestsText, setInterestsText] = useState("");
  const [prefCats, setPrefCats] = useState<string[]>([]);
  const [prefBrands, setPrefBrands] = useState<string[]>([]);
  const [maxBudget, setMaxBudget] = useState(1500);
  const [prefMessage, setPrefMessage] = useState("");

  // Profile state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar_url || "");
  const [profileMsg, setProfileMsg] = useState("");

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiRequest<DashboardData>("/api/dashboard");
      setData(res);
      setInterestsText(res.preferences.interests.join(", "));
      setPrefCats(res.preferences.preferredCategories);
      setPrefBrands(res.preferences.preferredBrands);
      setMaxBudget(res.preferences.maxBudget);
      setProfileName(user.name);
      setProfileAvatar(user.avatar_url || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Personalized User Dashboard
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Sign in to access your saved wishlist, AI preference learning controls, order history, and notifications.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer"
        >
          Sign In or Create Account
        </button>
      </div>
    );
  }

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setPrefMessage("");
    const interests = interestsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await apiRequest("/api/preferences", {
      method: "PUT",
      body: JSON.stringify({
        interests,
        preferredCategories: prefCats,
        preferredBrands: prefBrands,
        minBudget: 0,
        maxBudget,
      }),
    });
    setPrefMessage("Preferences updated. Recommendations will reflect your changes immediately.");
    loadDashboard();
  };

  const handleResetPreferences = async () => {
    await apiRequest("/api/preferences/reset", { method: "POST" });
    setPrefMessage("All shopping preferences and learned keywords have been reset.");
    loadDashboard();
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    const res = await apiRequest<{ user: User }>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: profileName, avatarUrl: profileAvatar }),
    });
    onUserUpdated(res.user);
    setProfileMsg("Profile updated.");
  };

  const handleVerifyEmail = async () => {
    await apiRequest("/api/auth/verify-email", { method: "POST", body: JSON.stringify({}) });
    onUserUpdated({ ...user, email_verified: 1 });
  };

  const markRead = async (id: number) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" });
    loadDashboard();
  };

  const toggleArr = (arr: string[], item: string, setter: (next: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {user.role === "admin" ? "Administrator Account" : "Customer Workspace"}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5">
            Welcome back, {user.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {user.email} · {user.email_verified ? "Verified Email" : "Email Unverified"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
        {[
          { id: "overview", label: "Overview" },
          { id: "preferences", label: "AI Preferences" },
          { id: "wishlist", label: `Wishlist (${data?.wishlist.length ?? 0})` },
          { id: "activity", label: "History & Notifications" },
          { id: "account", label: "Orders & Settings" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              tab === t.id
                ? "bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : (
        <>
          {tab === "overview" && data && (
            <div className="space-y-10">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Saved Wishlist</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.wishlist.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Target Max Budget</p>
                  <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    ${data.preferences.maxBudget}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">AI Chats Saved</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.conversations.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Demo Orders</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">{data.orders.length}</p>
                </div>
              </div>

              {/* Personalized Picks */}
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Personalized for Your Preferences
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {recommended.slice(0, 3).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onSelect={onSelectProduct}
                      onAddToCart={onAddToCart}
                      onToggleWishlist={onToggleWishlist}
                      onToggleCompare={onToggleCompare}
                      onAskAI={(prod) => onAskAI(prod)}
                      isWishlisted={wishlistIds.includes(p.id)}
                      isCompared={compareIds.includes(p.id)}
                    />
                  ))}
                </div>
              </div>

              {data.recentlyViewed.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Recently Viewed
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {data.recentlyViewed.slice(0, 3).map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onSelect={onSelectProduct}
                        onAddToCart={onAddToCart}
                        onToggleWishlist={onToggleWishlist}
                        onToggleCompare={onToggleCompare}
                        onAskAI={(prod) => onAskAI(prod)}
                        isWishlisted={wishlistIds.includes(p.id)}
                        isCompared={compareIds.includes(p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "preferences" && data && (
            <form
              onSubmit={handleSavePreferences}
              className="max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    AI Preference Learning Controls
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Review, edit, or reset the shopping interests and budget thresholds used to tailor recommendations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPreferences}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All</span>
                </button>
              </div>

              {prefMessage && (
                <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                  {prefMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Explicit Shopping Interests (comma-separated)
                </label>
                <input
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="Ultrabooks, Noise-Canceling Audio, Mobile Photography"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Preferred Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const active = prefCats.includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleArr(prefCats, c.name, setPrefCats)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Preferred Brands
                </label>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => {
                    const active = prefBrands.includes(b.name);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleArr(prefBrands, b.name, setPrefBrands)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Preferred Max Budget</span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ${maxBudget}
                  </span>
                </div>
                <input
                  type="range"
                  min={150}
                  max={3000}
                  step={50}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Keywords Learned from Your Conversations & Searches
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {data.preferences.learnedKeywords.length > 0
                    ? data.preferences.learnedKeywords.join(" · ")
                    : "None recorded yet."}
                </p>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
              >
                Save Preferences
              </button>
            </form>
          )}

          {tab === "wishlist" && data && (
            <div className="space-y-4">
              {data.wishlist.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center text-sm text-slate-500">
                  No favourite products saved yet. Click the heart icon on any product to track its price here.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.wishlist.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.collection_name} · {item.brand_name}
                          </p>
                          <button
                            type="button"
                            onClick={() => onSelectProduct(item as unknown as Product)}
                            className="text-left font-display text-base font-semibold text-slate-900 dark:text-white hover:text-indigo-600 mt-0.5 cursor-pointer"
                          >
                            {item.name}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleWishlist({ id: (item as unknown as { product_id: number }).product_id } as Product)}
                          aria-label="Remove from wishlist"
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        ${item.lowest_price}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onAddToCart({ id: (item as unknown as { product_id: number }).product_id } as Product)}
                          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium cursor-pointer"
                        >
                          Add to Cart
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAskAI(undefined, `Find similar alternatives to ${item.name} under $${item.lowest_price + 100}`)
                          }
                          className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Similar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "activity" && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notifications */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
                <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Notifications</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">No notifications.</p>
                  ) : (
                    data.notifications.map((n) => (
                      <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className={`text-xs font-semibold ${n.is_read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                        </div>
                        {!n.is_read && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Search History & Saved Comparisons */}
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Saved Comparisons
                  </h3>
                  {data.savedComparisons.length === 0 ? (
                    <p className="text-xs text-slate-500">No saved comparisons yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.savedComparisons.map((sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => onOpenCompare(JSON.parse(sc.product_ids_json))}
                          className="w-full text-left px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-400 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {sc.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Recent Search History
                  </h3>
                  {data.searchHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">No recent searches logged.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {data.searchHistory.map((sh) => (
                        <li key={sh.id} className="py-2 flex justify-between text-slate-700 dark:text-slate-300">
                          <span>{sh.query}</span>
                          <span className="font-mono text-slate-400">{sh.created_at.slice(0, 10)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "account" && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleProfileSave}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4"
              >
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Account Settings
                </h2>
                {profileMsg && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{profileMsg}</span>
                  </p>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Avatar Image URL
                  </label>
                  <input
                    type="url"
                    value={profileAvatar}
                    onChange={(e) => setProfileAvatar(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium cursor-pointer"
                  >
                    Save Profile
                  </button>
                  {!user.email_verified && (
                    <button
                      type="button"
                      onClick={handleVerifyEmail}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Verify Email Now
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Order Reservations ({data.orders.length})
                </h2>
                {data.orders.length === 0 ? (
                  <p className="text-xs text-slate-500">No orders placed yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {data.orders.map((o) => (
                      <div key={o.id} className="py-3 flex items-center justify-between gap-4 tabular-nums">
                        <div>
                          <p className="font-mono font-semibold text-slate-900 dark:text-white">{o.order_number}</p>
                          <p className="text-slate-500 dark:text-slate-400">{o.status}</p>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">${o.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
