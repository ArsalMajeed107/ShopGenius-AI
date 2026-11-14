import { useState } from "react";
import type { FormEvent } from "react";
import { Search, ArrowRight, ChevronDown, MessageSquare, CheckCircle2 } from "lucide-react";
import type { Product, Category, Brand, Announcement } from "../types";
import { ProductCard } from "./ProductCard";
import { SmartImage } from "./SmartImage";
import { apiRequest } from "../lib/api";

interface HomeViewProps {
  recommended: Product[];
  trending: Product[];
  bestDeals: Product[];
  mostPopular: Product[];
  recentlyViewed: Product[];
  allProducts: Product[];
  categories: Category[];
  brands: Brand[];
  announcements: Announcement[];
  wishlistIds: number[];
  compareIds: number[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  onAskAI: (product?: Product, initialPrompt?: string) => void;
  onOpenCatalog: (category?: string, query?: string) => void;
}

const SUGGESTED_QUERIES = [
  "Find me the best laptop under $800",
  "Recommend a smartphone with a good camera",
  "Find affordable wireless headphones",
  "Suggest a laptop for AI and machine learning",
];

const TESTIMONIALS = [
  {
    name: "Elena Rostova",
    role: "Staff Software Engineer, Northstar Systems",
    quote:
      "I asked ShopGenius AI for a quiet Linux-friendly ultrabook under $800 and compared three store offers in under two minutes, saving $70 on my AeroBook Lite 14.",
  },
  {
    name: "Marcus Chen",
    role: "Creative Director, Studio Meridian",
    quote:
      "The AI review analyzer surfaced thermal throttling complaints on a rival laptop before I bought it, steering me straight to the right workstation.",
  },
  {
    name: "Priya Nair",
    role: "Product Manager, Horizon Labs",
    quote:
      "Having side-by-side iPhone and Samsung camera comparisons grounded in verified specifications saved hours of tab switching.",
  },
];

const FAQS = [
  {
    q: "How does ShopGenius AI find and recommend products?",
    a: "When you ask a question or use Smart Search, our server-side Gemini 4 assistant invokes structured catalog tools to query real database specifications, verified store prices, and customer reviews—never inventing products or prices.",
  },
  {
    q: "Are the store prices and discounts live external feeds?",
    a: "This application ships with a clearly labeled Demonstration Catalog containing multi-store offers, shipping policies, and verification timestamps so you can test price comparison and cart workflows safely.",
  },
  {
    q: "How does the AI Review Analyzer separate facts from opinions?",
    a: "The analyzer synthesizes only the submitted customer reviews for each product into sentiment, strengths, weaknesses, and common complaints, and displays the AI summary separately from the original customer reviews.",
  },
  {
    q: "Can I control or reset what the AI learns about my preferences?",
    a: "Yes. Open your User Dashboard at any time to inspect, edit, or completely reset your saved categories, budget range, and learned search keywords.",
  },
];

export function HomeView({
  recommended,
  trending,
  bestDeals,
  mostPopular,
  recentlyViewed,
  allProducts,
  categories,
  brands,
  announcements,
  wishlistIds,
  compareIds,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  onToggleCompare,
  onAskAI,
  onOpenCatalog,
}: HomeViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeTab, setActiveTab] = useState<"recommended" | "trending" | "deals" | "popular" | "recent">("recommended");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterMsg, setNewsletterMsg] = useState("");
  const [newsletterErr, setNewsletterErr] = useState("");
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(false);

  const autocompleteMatches = searchInput.trim()
    ? allProducts
        .filter(
          (p) =>
            p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
            p.brand_name.toLowerCase().includes(searchInput.toLowerCase()) ||
            p.category_name.toLowerCase().includes(searchInput.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const handleHeroSearch = (e: FormEvent) => {
    e.preventDefault();
    setShowAutocomplete(false);
    if (searchInput.trim()) {
      onOpenCatalog(undefined, searchInput.trim());
    } else {
      onOpenCatalog();
    }
  };

  const handleNewsletter = async (e: FormEvent) => {
    e.preventDefault();
    setNewsletterErr("");
    setNewsletterMsg("");
    try {
      const res = await apiRequest<{ message: string }>("/api/newsletter", {
        method: "POST",
        body: JSON.stringify({ email: newsletterEmail }),
      });
      setNewsletterMsg(res.message);
      setNewsletterEmail("");
    } catch (err) {
      setNewsletterErr(err instanceof Error ? err.message : "Subscription failed.");
    }
  };

  const tabProducts =
    activeTab === "recommended"
      ? recommended
      : activeTab === "trending"
        ? trending
        : activeTab === "deals"
          ? bestDeals
          : activeTab === "popular"
            ? mostPopular
            : recentlyViewed;

  return (
    <div className="space-y-20 pb-16">
      {/* Slim Dismissible Announcement Bar */}
      {announcements.length > 0 && !dismissedAnnouncement && (
        <div className="border-b border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4 text-xs">
            <p className="text-slate-700 dark:text-slate-300 truncate">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">{announcements[0].title}:</span>{" "}
              {announcements[0].body}
            </p>
            <button
              type="button"
              onClick={() => setDismissedAnnouncement(true)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-white shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 1. Split Hero Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Copy + AI Search Bar + Primary CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Intelligent Personal Shopping Platform
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 dark:text-white text-balance leading-[1.1]"
                style={{ fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
              >
                Your Personal AI Shopping Assistant
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                Discover your favourite products, compare prices, explore reviews, and shop smarter with the power of AI.
              </p>
            </div>

            {/* Interactive AI Natural-Language Search Bar */}
            <div className="relative max-w-2xl">
              <form
                onSubmit={handleHeroSearch}
                className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all"
              >
                <Search className="w-5 h-5 text-slate-400 ml-4 shrink-0" />
                <input
                  type="text"
                  value={searchInput}
                  onFocus={() => setShowAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowAutocomplete(false), 180)}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowAutocomplete(true);
                  }}
                  placeholder="Try: Find me the best laptop under $800..."
                  className="w-full px-3.5 py-3.5 bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="m-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  Smart Search
                </button>
              </form>

              {showAutocomplete && (autocompleteMatches.length > 0 || !searchInput.trim()) && (
                <div className="absolute left-0 right-0 mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl z-30 overflow-hidden">
                  {autocompleteMatches.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {autocompleteMatches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => onSelectProduct(p)}
                          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {p.brand_name} · {p.category_name}
                            </p>
                          </div>
                          <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            ${p.lowest_price}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 space-y-1">
                      <p className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        Recommended natural-language queries
                      </p>
                      {SUGGESTED_QUERIES.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onMouseDown={() => onOpenCatalog(undefined, q)}
                          className="w-full px-2.5 py-2 rounded-lg text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Required Hero Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onOpenCatalog()}
                className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onAskAI(undefined, "Find me the best laptop under $800")}
                className="h-11 px-6 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Ask AI Assistant</span>
              </button>
            </div>
          </div>

          {/* Right Column: Stretched 16:9 Studio Hero Showcase */}
          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[280px]">
            <SmartImage
              imageKey="hero"
              alt="ShopGenius AI curated flagship devices showcase"
              className="w-full h-full lg:h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex flex-col justify-end p-6">
              <p className="text-xs font-medium text-indigo-300 mb-1">
                Verified Demo Catalog · Multi-Store Comparison
              </p>
              <p className="font-display text-base font-semibold text-white">
                Real catalog specifications, instant store price checks, and review intelligence in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Workspace Quick-Discovery Strip Below Hero */}
        <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">Popular Categories:</span>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpenCatalog(cat.slug)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-indigo-400 dark:hover:border-indigo-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Featured Brands:</span>
            {brands.slice(0, 5).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onOpenCatalog(undefined, b.name)}
                className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Personalized & Curated Discovery Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Curated Product Discovery
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Every recommendation explains why it matches your interests, budget, and ratings.
            </p>
          </div>

          {/* Interactive Discovery Mode Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {[
              { id: "recommended", label: "Recommended for You" },
              { id: "trending", label: "Trending" },
              { id: "deals", label: "Best Deals" },
              { id: "popular", label: "Most Popular" },
              ...(recentlyViewed.length > 0 ? [{ id: "recent", label: "Recently Viewed" }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tabProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              onAddToCart={onAddToCart}
              onToggleWishlist={onToggleWishlist}
              onToggleCompare={onToggleCompare}
              onAskAI={(p) => onAskAI(p, `Tell me if ${p.name} is worth buying and compare its store prices.`)}
              isWishlisted={wishlistIds.includes(product.id)}
              isCompared={compareIds.includes(product.id)}
            />
          ))}
        </div>
      </section>

      {/* 3. Value Architecture & Attributable Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">01. Natural Language Discovery</p>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Search by intent, not model codes
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Describe what you need in plain sentences. Gemini 4 parses budget constraints, use cases, and hardware specs directly against the catalog.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">02. Verified Price Comparison</p>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Multi-store clarity with zero guesswork
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Compare current prices, previous price history, shipping charges, and stock availability across connected stores with the lowest offer highlighted.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">03. Review Intelligence</p>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Balanced strengths and real complaints
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Read AI-distilled review summaries alongside authentic customer feedback so potential weaknesses like battery drain or thermals never surprise you.
            </p>
          </div>
        </div>

        {/* Attributable Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 flex flex-col justify-between space-y-4"
            >
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">"{t.quote}"</p>
              <footer>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* 4. FAQ & Newsletter + Footer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10 border-t border-slate-200 dark:border-slate-800">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Newsletter Subscription */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 space-y-4">
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Weekly Price & Product Briefings
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Receive verified discount alerts, side-by-side hardware guides, and curated category reports.
            </p>
            <form onSubmit={handleNewsletter} className="space-y-3">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Subscribe to Briefings
              </button>
            </form>
            {newsletterMsg && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{newsletterMsg}</span>
              </p>
            )}
            {newsletterErr && <p className="text-xs text-rose-600 dark:text-rose-400">{newsletterErr}</p>}
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div>
          <span className="font-display font-semibold text-slate-900 dark:text-white">ShopGenius AI</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>Intelligent Shopping, Personalized for You.</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => onOpenCatalog()} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
            Catalog
          </button>
          <button type="button" onClick={() => onAskAI()} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
            AI Assistant
          </button>
          <span>Demonstration Catalog · © 2026 ShopGenius AI</span>
        </div>
      </footer>
    </div>
  );
}
