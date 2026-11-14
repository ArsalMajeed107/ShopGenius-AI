import { useEffect, useState } from "react";
import { Plus, X, ShoppingBag, BookmarkCheck } from "lucide-react";
import type { Product, User } from "../types";
import { apiRequest } from "../lib/api";
import { SmartImage } from "./SmartImage";

interface CompareViewProps {
  allProducts: Product[];
  compareIds: number[];
  user: User | null;
  onSetCompareIds: (ids: number[]) => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onOpenAuth: () => void;
}

export function CompareView({
  allProducts,
  compareIds,
  user,
  onSetCompareIds,
  onSelectProduct,
  onAddToCart,
  onOpenAuth,
}: CompareViewProps) {
  const [detailedProducts, setDetailedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  const effectiveIds = compareIds.length > 0 ? compareIds : allProducts.slice(0, 2).map((p) => p.id);

  useEffect(() => {
    if (effectiveIds.length === 0) {
      setDetailedProducts([]);
      return;
    }
    setLoading(true);
    apiRequest<{ products: Product[] }>("/api/compare", {
      method: "POST",
      body: JSON.stringify({ productIds: effectiveIds }),
    })
      .then((res) => setDetailedProducts(res.products))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIds.join(",")]);

  const allSpecKeys = Array.from(
    new Set(detailedProducts.flatMap((p) => Object.keys(p.specs || {})))
  );

  const handleSaveComparison = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    const title = detailedProducts.map((p) => p.name.split(" ").slice(0, 2).join(" ")).join(" vs ");
    await apiRequest("/api/compare", {
      method: "POST",
      body: JSON.stringify({ productIds: effectiveIds, saveTitle: title }),
    });
    setSavedNotice(`Saved "${title}" to your User Dashboard.`);
  };

  const applyPreset = (slugA: string, slugB: string) => {
    const a = allProducts.find((p) => p.slug === slugA);
    const b = allProducts.find((p) => p.slug === slugB);
    if (a && b) onSetCompareIds([a.id, b.id]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Side-by-Side Product & Price Comparison
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Compare up to 3 products across verified store pricing, specs, and customer ratings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset("apple-iphone-16-pro", "samsung-galaxy-s25-ultra")}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
          >
            Preset: iPhone vs Samsung
          </button>
          <button
            type="button"
            onClick={() => applyPreset("aerobook-lite-14", "aerobook-studio-ml-pro-16")}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
          >
            Preset: Budget vs ML Laptop
          </button>
          <button
            type="button"
            onClick={handleSaveComparison}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Save Comparison</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {savedNotice}
        </div>
      )}

      {/* Product Selector Slots */}
      <div className="flex flex-wrap items-center gap-3">
        {[0, 1, 2].map((slot) => {
          const currentId = effectiveIds[slot] || "";
          return (
            <div key={slot} className="flex items-center gap-2">
              <select
                value={currentId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const copy = [...effectiveIds];
                  if (val) {
                    copy[slot] = val;
                    onSetCompareIds(Array.from(new Set(copy)).slice(0, 3));
                  }
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm text-slate-900 dark:text-white"
              >
                <option value="">+ Add Slot {slot + 1}</option>
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.lowest_price})
                  </option>
                ))}
              </select>
              {currentId && effectiveIds.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove product from comparison"
                  onClick={() => onSetCompareIds(effectiveIds.filter((id) => id !== currentId))}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
      ) : detailedProducts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center space-y-3">
          <Plus className="w-8 h-8 mx-auto text-slate-400" />
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Select products above to compare
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="p-5 w-48 text-xs font-medium text-slate-500 dark:text-slate-400 align-top">
                  Comparison Matrix
                </th>
                {detailedProducts.map((p) => (
                  <th key={p.id} className="p-5 min-w-[240px] align-top">
                    <div
                      onClick={() => onSelectProduct(p)}
                      className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3 cursor-pointer"
                    >
                      <SmartImage imageKey={p.image_key} alt={p.name} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                      {p.brand_name} · {p.category_name}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectProduct(p)}
                      className="text-left font-display text-base font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 mt-0.5 cursor-pointer"
                    >
                      {p.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              <tr>
                <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">Lowest Verified Price</td>
                {detailedProducts.map((p) => (
                  <td key={p.id} className="p-4 font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    ${p.lowest_price.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">Lowest Offer Store</td>
                {detailedProducts.map((p) => {
                  const best = p.offers?.find((o) => o.is_lowest) || p.offers?.[0];
                  return (
                    <td key={p.id} className="p-4 text-xs text-slate-700 dark:text-slate-300">
                      {best ? `${best.store_name} (${best.shipping_cost === 0 ? "Free shipping" : `$${best.shipping_cost} ship`})` : "ShopGenius Direct"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">Customer Rating</td>
                {detailedProducts.map((p) => (
                  <td key={p.id} className="p-4 font-mono text-sm text-slate-900 dark:text-white">
                    {p.rating.toFixed(1)} / 5 ({p.review_count} reviews)
                  </td>
                ))}
              </tr>
              {allSpecKeys.map((specKey) => (
                <tr key={specKey}>
                  <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">{specKey}</td>
                  {detailedProducts.map((p) => (
                    <td key={p.id} className="p-4 text-sm text-slate-700 dark:text-slate-300">
                      {p.specs?.[specKey] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">Purchase</td>
                {detailedProducts.map((p) => (
                  <td key={p.id} className="p-4">
                    <button
                      type="button"
                      onClick={() => onAddToCart(p)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
