import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Heart, Scale, ShoppingBag, Star, MessageSquare, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import type { Product, ReviewAnalysis } from "../types";
import { apiRequest } from "../lib/api";
import { SmartImage } from "./SmartImage";
import { ProductCard } from "./ProductCard";

interface ProductDetailViewProps {
  productIdOrSlug: string | number;
  wishlistIds: number[];
  compareIds: number[];
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, storeId?: number) => void;
  onToggleWishlist: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  onAskAI: (product: Product, prompt?: string) => void;
}

export function ProductDetailView({
  productIdOrSlug,
  wishlistIds,
  compareIds,
  onBack,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  onToggleCompare,
  onAskAI,
}: ProductDetailViewProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined);

  // Review form
  const [authorName, setAuthorName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAnalysisError("");
    apiRequest<{ product: Product; reviewAnalysis: ReviewAnalysis | null }>(`/api/products/${productIdOrSlug}`)
      .then((res) => {
        if (!active) return;
        setProduct(res.product);
        setAnalysis(res.reviewAnalysis);
        setActiveImage(res.product.image_key);
        const lowestOffer = res.product.offers?.find((o) => o.is_lowest) || res.product.offers?.[0];
        setSelectedStoreId(lowestOffer?.store_id);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productIdOrSlug]);

  const runReviewAnalysis = async (force = false) => {
    if (!product) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const res = await apiRequest<{ analysis: ReviewAnalysis }>(`/api/ai/analyze-reviews/${product.id}`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setAnalysis(res.analysis);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Could not analyze reviews.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setReviewNotice("");
    const res = await apiRequest<{ reviews: Product["reviews"]; rating: number; review_count: number }>(
      `/api/products/${product.id}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({
          authorName,
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        }),
      }
    );
    setProduct({
      ...product,
      reviews: res.reviews,
      rating: res.rating,
      review_count: res.review_count,
    });
    setAuthorName("");
    setReviewTitle("");
    setReviewComment("");
    setReviewNotice("Thank you. Your review has been added and the AI summary cache refreshed.");
  };

  if (loading || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 aspect-[4/3] rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="lg:col-span-6 space-y-4">
            <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const offers = product.offers || [];
  const selectedOffer = offers.find((o) => o.store_id === selectedStoreId) || offers[0];
  const displayPrice = selectedOffer ? selectedOffer.current_price : product.lowest_price;
  const isWishlisted = wishlistIds.includes(product.id);
  const isCompared = compareIds.includes(product.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      {/* Top Split: Sticky Gallery + Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 lg:sticky lg:top-24 space-y-4">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
            <SmartImage imageKey={activeImage || product.image_key} alt={product.name} />
          </div>
          {product.gallery_keys.length > 1 && (
            <div className="flex gap-3">
              {product.gallery_keys.map((gk, idx) => (
                <button
                  key={`${gk}-${idx}`}
                  type="button"
                  onClick={() => setActiveImage(gk)}
                  className={`w-20 aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                    activeImage === gk ? "border-indigo-600" : "border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100"
                  }`}
                >
                  <SmartImage imageKey={gk} alt={`${product.name} view ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contiguous Purchase Module */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{product.brand_name}</span>
              <span aria-hidden="true">·</span>
              <span>{product.category_name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">SKU {product.sku}</span>
              <span aria-hidden="true">·</span>
              <span>{product.in_stock ? `${product.stock_count} In Stock` : "Out of Stock"}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
              {product.name}
            </h1>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-slate-900 dark:text-white">{product.rating.toFixed(1)}</span>
              <span>({product.review_count} verified customer reviews)</span>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            {product.description}
          </p>

          {/* Price & Store Selector */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3 tabular-nums">
                <span className="font-mono text-3xl font-bold text-slate-900 dark:text-white">
                  ${displayPrice.toLocaleString()}
                </span>
                {selectedOffer?.previous_price && selectedOffer.previous_price > displayPrice && (
                  <span className="font-mono text-sm text-slate-400 line-through">
                    ${selectedOffer.previous_price.toLocaleString()}
                  </span>
                )}
                {selectedOffer && selectedOffer.discount_percent > 0 && (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Save {selectedOffer.discount_percent}%
                  </span>
                )}
              </div>
              {selectedOffer?.is_lowest && (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Lowest Verified Price</span>
                </span>
              )}
            </div>

            {offers.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Selected Demonstration Store Offer
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                >
                  {offers.map((o) => (
                    <option key={o.id} value={o.store_id}>
                      {o.store_name} — ${o.current_price} ({o.shipping_cost === 0 ? "Free shipping" : `+$${o.shipping_cost} ship`})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => onAddToCart(product, selectedStoreId)}
                disabled={!product.in_stock}
                className="flex-1 h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Cart</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleWishlist(product)}
                className={`h-11 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isWishlisted
                    ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
                <span>{isWishlisted ? "Saved" : "Wishlist"}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  onAskAI(
                    product,
                    `I am looking at ${product.name}. Find the cheapest available price, highlight pros and cons from reviews, and tell me who it is best for.`
                  )
                }
                className="flex-1 h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Ask AI About This Product</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleCompare(product)}
                className={`h-10 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  isCompared
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>{isCompared ? "In Compare" : "Compare"}</span>
              </button>
            </div>
          </div>

          {/* Specifications Table */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Technical Specifications
            </h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#111827] divide-y divide-slate-100 dark:divide-slate-800">
              {Object.entries(product.specs).map(([key, val]) => (
                <div key={key} className="px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{key}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 text-right tabular-nums">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Price Comparison Engine */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Smart Price Comparison
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Verified offers across connected demonstration stores. Lowest total price is highlighted automatically.
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Demonstration Store Feed · No invented retail offers
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4 font-medium">Store</th>
                <th className="py-3.5 px-4 font-medium">Current Price</th>
                <th className="py-3.5 px-4 font-medium">Previous / Discount</th>
                <th className="py-3.5 px-4 font-medium">Shipping</th>
                <th className="py-3.5 px-4 font-medium">Availability</th>
                <th className="py-3.5 px-4 font-medium">Last Verified</th>
                <th className="py-3.5 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 tabular-nums">
              {offers.map((offer) => (
                <tr
                  key={offer.id}
                  className={offer.is_lowest ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}
                >
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{offer.store_name}</span>
                      {offer.is_lowest && (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Lowest Price
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{offer.store_domain}</p>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                    ${offer.current_price.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {offer.previous_price ? (
                      <span className="font-mono text-slate-400 line-through mr-2">
                        ${offer.previous_price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {offer.discount_percent > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        -{offer.discount_percent}%
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                    {offer.shipping_cost === 0 ? "Free" : `$${offer.shipping_cost.toFixed(2)}`}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{offer.availability}</td>
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                    {offer.last_verified_at.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAddToCart(product, offer.store_id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-600 cursor-pointer"
                      >
                        Select
                      </button>
                      <a
                        href={offer.product_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${offer.store_name} listing`}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI Product Review Analyzer + Authentic Customer Reviews */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* AI-Generated Review Summary */}
        <div className="lg:col-span-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-[#111827] p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                AI-Generated Review Summary
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                Review Intelligence
              </h2>
            </div>
            <button
              type="button"
              onClick={() => runReviewAnalysis(true)}
              disabled={analyzing}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{analyzing ? "Analyzing..." : analysis ? "Refresh AI" : "Analyze Reviews"}</span>
            </button>
          </div>

          {analysisError && <p className="text-xs text-rose-600 dark:text-rose-400">{analysisError}</p>}

          {analysis ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between py-2 border-y border-indigo-200/70 dark:border-slate-800 tabular-nums">
                <span className="text-slate-600 dark:text-slate-400">Overall Sentiment</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {analysis.overall_sentiment} ({analysis.sentiment_score}/100)
                </span>
              </div>

              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{analysis.summary}</p>

              {analysis.strengths.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                    Key Strengths
                  </h3>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                    {analysis.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(analysis.weaknesses.length > 0 || analysis.common_complaints.length > 0) && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                    Weaknesses & Common Complaints
                  </h3>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                    {[...analysis.weaknesses, ...analysis.common_complaints].slice(0, 4).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.frequently_mentioned_features.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Frequently Mentioned Features
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {analysis.frequently_mentioned_features.join(" · ")}
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-indigo-200/70 dark:border-slate-800">
                Synthesized by Gemini 4 strictly from the original customer reviews listed alongside.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Click "Analyze Reviews" to generate an objective AI summary of sentiment, product strengths, weaknesses, and common complaints from customer feedback.
              </p>
              <button
                type="button"
                onClick={() => runReviewAnalysis(false)}
                disabled={analyzing}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {analyzing ? "Analyzing Customer Reviews..." : "Run AI Review Analysis"}
              </button>
            </div>
          )}
        </div>

        {/* Original Customer Reviews + Add Review */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Original Customer Reviews ({product.reviews?.length || 0})
          </h2>

          <div className="space-y-4">
            {(product.reviews || []).map((rev) => (
              <article
                key={rev.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-2"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">{rev.author_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{rev.verified_purchase ? "Verified Buyer" : "Customer"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{rev.rating}/5</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{rev.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{rev.comment}</p>
              </article>
            ))}
          </div>

          <form
            onSubmit={handleSubmitReview}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3.5"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">Write a Review</h3>
            {reviewNotice && <p className="text-xs text-emerald-700 dark:text-emerald-400">{reviewNotice}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Your Name (optional if signed in)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              >
                <option value={5}>5 Stars — Excellent</option>
                <option value={4}>4 Stars — Very Good</option>
                <option value={3}>3 Stars — Average</option>
                <option value={2}>2 Stars — Below Expectations</option>
                <option value={1}>1 Star — Poor</option>
              </select>
            </div>
            <input
              type="text"
              required
              placeholder="Review headline"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
            <textarea
              required
              rows={3}
              placeholder="Share what worked well and any drawbacks..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer"
            >
              Submit Review
            </button>
          </form>
        </div>
      </section>

      {/* Similar & Frequently Bought Together */}
      {product.similar && product.similar.length > 0 && (
        <section className="space-y-5 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Similar & Frequently Compared Products
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {product.similar.map((sim) => (
              <ProductCard
                key={sim.id}
                product={sim}
                onSelect={onSelectProduct}
                onAddToCart={(p) => onAddToCart(p)}
                onToggleWishlist={onToggleWishlist}
                onToggleCompare={onToggleCompare}
                onAskAI={(p) => onAskAI(p)}
                isWishlisted={wishlistIds.includes(sim.id)}
                isCompared={compareIds.includes(sim.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
