import { Heart, Scale, ShoppingBag, Star, MessageSquare } from "lucide-react";
import type { Product } from "../types";
import { SmartImage } from "./SmartImage";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  onToggleCompare: (product: Product) => void;
  onAskAI: (product: Product) => void;
  isWishlisted?: boolean;
  isCompared?: boolean;
}

export function ProductCard({
  product,
  onSelect,
  onAddToCart,
  onToggleWishlist,
  onToggleCompare,
  onAskAI,
  isWishlisted = false,
  isCompared = false,
}: ProductCardProps) {
  const hasSavings = product.lowest_price < product.base_price || product.highest_discount > 0;

  return (
    <article className="group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/50">
      {/* 4:3 Product Media */}
      <div
        onClick={() => onSelect(product)}
        className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-pointer"
      >
        <SmartImage
          imageKey={product.image_key}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product);
          }}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className={`absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center backdrop-blur-md border transition-colors cursor-pointer ${
            isWishlisted
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-white/85 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Card Body */}
      <div className="flex flex-col flex-1 p-5">
        {/* Zero-Pill Unboxed Metadata */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5 truncate">
          <span className="font-medium text-slate-700 dark:text-slate-300">{product.brand_name}</span>
          <span aria-hidden="true">·</span>
          <span>{product.category_name}</span>
          <span aria-hidden="true">·</span>
          <span>{product.in_stock ? "In Stock" : "Out of Stock"}</span>
        </div>

        <button
          type="button"
          onClick={() => onSelect(product)}
          className="text-left font-display text-base font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 cursor-pointer"
        >
          {product.name}
        </button>

        {/* Rating & Review Count */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">{product.rating.toFixed(1)}</span>
          <span aria-hidden="true">·</span>
          <span>{product.review_count} reviews</span>
        </div>

        {product.recommendation_reason && (
          <p className="mt-2.5 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300 line-clamp-2">
            {product.recommendation_reason}
          </p>
        )}

        {/* Price + Actions */}
        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="font-mono text-lg font-semibold text-slate-900 dark:text-white">
              ${product.lowest_price.toLocaleString()}
            </span>
            {hasSavings && product.base_price > product.lowest_price && (
              <span className="font-mono text-xs text-slate-400 line-through">
                ${product.base_price.toLocaleString()}
              </span>
            )}
            {product.highest_discount > 0 && (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                -{product.highest_discount}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleCompare(product)}
              title={isCompared ? "Remove from comparison" : "Compare product"}
              aria-label={`Compare ${product.name}`}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                isCompared
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Scale className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onAskAI(product)}
              title="Ask AI about this product"
              aria-label={`Ask AI about ${product.name}`}
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              disabled={!product.in_stock}
              className="h-9 px-3 rounded-lg bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
