import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import type { Brand, Category, Product } from "../types";
import { apiRequest } from "../lib/api";
import { ProductCard } from "./ProductCard";

interface CatalogViewProps {
  categories: Category[];
  brands: Brand[];
  initialCategory?: string;
  initialQuery?: string;
  wishlistIds: number[];
  compareIds: number[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  onAskAI: (product?: Product, prompt?: string) => void;
}

const EXAMPLE_SEARCHES = [
  "best laptop under $800",
  "smartphone with great telephoto camera",
  "affordable wireless ANC headphones",
  "laptop for AI and machine learning",
];

export function CatalogView({
  categories,
  brands,
  initialCategory = "all",
  initialQuery = "",
  wishlistIds,
  compareIds,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  onToggleCompare,
  onAskAI,
}: CatalogViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [brand, setBrand] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number>(2500);
  const [minRating, setMinRating] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"popularity" | "price_asc" | "price_desc" | "rating">("popularity");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiIntentSummary, setAiIntentSummary] = useState("");
  const [aiError, setAiError] = useState("");
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const fetchFiltered = async (opts?: {
    q?: string;
    cat?: string;
    br?: string;
    maxP?: number;
    minR?: number;
    stock?: boolean;
    sort?: string;
  }) => {
    setLoading(true);
    setAiError("");
    try {
      const params = new URLSearchParams();
      const qVal = opts?.q ?? query;
      const catVal = opts?.cat ?? category;
      const brVal = opts?.br ?? brand;
      const maxVal = opts?.maxP ?? maxPrice;
      const minRVal = opts?.minR ?? minRating;
      const stockVal = opts?.stock ?? inStockOnly;
      const sortVal = opts?.sort ?? sortBy;

      if (qVal.trim()) params.set("q", qVal.trim());
      if (catVal && catVal !== "all") params.set("category", catVal);
      if (brVal && brVal !== "all") params.set("brand", brVal);
      if (maxVal < 2500) params.set("maxPrice", String(maxVal));
      if (minRVal > 0) params.set("minRating", String(minRVal));
      if (stockVal) params.set("inStockOnly", "true");
      params.set("sortBy", sortVal);

      const res = await apiRequest<{ products: Product[] }>(`/api/products?${params.toString()}`);
      setProducts(res.products);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to load catalog.");
    } finally {
      setLoading(false);
    }
  };

  const runNaturalSmartSearch = async (text: string) => {
    if (!text.trim()) {
      setAiIntentSummary("");
      fetchFiltered({ q: "" });
      return;
    }
    setLoading(true);
    setAiError("");
    setRecentQueries((prev) => [text.trim(), ...prev.filter((x) => x !== text.trim())].slice(0, 5));
    try {
      const res = await apiRequest<{
        intentSummary: string;
        extractedFilters: {
          category?: string;
          brand?: string;
          maxPrice?: number;
          minRating?: number;
          sortBy?: string;
        };
        products: Product[];
      }>("/api/ai/smart-search", {
        method: "POST",
        body: JSON.stringify({ query: text.trim() }),
      });
      setAiIntentSummary(res.intentSummary);
      setProducts(res.products);
      if (res.extractedFilters.category) setCategory(res.extractedFilters.category.toLowerCase());
      if (res.extractedFilters.maxPrice) setMaxPrice(res.extractedFilters.maxPrice);
    } catch (err) {
      // Fall back to direct catalog filter and propagate AI notice cleanly
      setAiError(err instanceof Error ? err.message : "AI parser unavailable; showing direct catalog matches.");
      await fetchFiltered({ q: text.trim() });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      runNaturalSmartSearch(initialQuery);
    } else {
      setCategory(initialCategory || "all");
      fetchFiltered({ cat: initialCategory || "all", q: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory, initialQuery]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runNaturalSmartSearch(query);
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setBrand("all");
    setMaxPrice(2500);
    setMinRating(0);
    setInStockOnly(false);
    setSortBy("popularity");
    setAiIntentSummary("");
    setAiError("");
    fetchFiltered({ q: "", cat: "all", br: "all", maxP: 2500, minR: 0, stock: false, sort: "popularity" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header + Natural Language Search */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Smart Product Catalog
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Search in plain English or filter by category, brand, budget, and customer rating.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {products.length} products matched · Demonstration Catalog
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask in natural language, e.g. 'best laptop under $800 for programming'..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium whitespace-nowrap cursor-pointer"
          >
            AI Smart Search
          </button>
        </form>

        {/* Suggested Queries & Search History */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Try:</span>
          {EXAMPLE_SEARCHES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s);
                runNaturalSmartSearch(s);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
          {recentQueries.length > 0 && (
            <>
              <span className="text-slate-400 mx-1" aria-hidden="true">·</span>
              <span className="text-slate-500 dark:text-slate-400">Recent:</span>
              {recentQueries.map((rq) => (
                <button
                  key={rq}
                  type="button"
                  onClick={() => {
                    setQuery(rq);
                    runNaturalSmartSearch(rq);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {rq}
                </button>
              ))}
            </>
          )}
        </div>

        {aiIntentSummary && (
          <div className="px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-sm text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-4">
            <span>{aiIntentSummary}</span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:underline shrink-0 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {aiError && (
          <div className="px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200">
            {aiError}
          </div>
        )}
      </div>

      {/* Filters Sidebar + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Filters</span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                fetchFiltered({ cat: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Brand</label>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                fetchFiltered({ br: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Max Budget</span>
              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {maxPrice >= 2500 ? "Any" : `$${maxPrice}`}
              </span>
            </div>
            <input
              type="range"
              min={150}
              max={2500}
              step={50}
              value={maxPrice}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxPrice(v);
                fetchFiltered({ maxP: v });
              }}
              className="w-full accent-indigo-600"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Minimum Rating</label>
            <select
              value={minRating}
              onChange={(e) => {
                const r = Number(e.target.value);
                setMinRating(r);
                fetchFiltered({ minR: r });
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            >
              <option value={0}>Any Rating</option>
              <option value={4.5}>4.5+ Stars</option>
              <option value={4.8}>4.8+ Stars</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => {
                const s = e.target.value as typeof sortBy;
                setSortBy(s);
                fetchFiltered({ sort: s });
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            >
              <option value="popularity">Most Popular</option>
              <option value="price_asc">Lowest Price</option>
              <option value="price_desc">Highest Price</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                fetchFiltered({ stock: e.target.checked });
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>In-stock items only</span>
          </label>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center space-y-3">
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                No catalog items matched those exact filters
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Try broadening your price ceiling or asking the AI Shopping Assistant for recommendations.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium cursor-pointer"
                >
                  Reset All Filters
                </button>
                <button
                  type="button"
                  onClick={() => onAskAI(undefined, query || "Show me your best value laptops and audio gear")}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Ask AI Assistant
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={onSelectProduct}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  onToggleCompare={onToggleCompare}
                  onAskAI={(p) => onAskAI(p, `Tell me more about ${p.name} and compare its price across stores.`)}
                  isWishlisted={wishlistIds.includes(product.id)}
                  isCompared={compareIds.includes(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
