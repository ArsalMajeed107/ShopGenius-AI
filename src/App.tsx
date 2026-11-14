import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import type {
  Announcement,
  AppView,
  Brand,
  CartPayload,
  Category,
  Product,
  User,
} from "./types";
import { apiRequest } from "./lib/api";
import { Navbar } from "./components/Navbar";
import { HomeView } from "./components/HomeView";
import { CatalogView } from "./components/CatalogView";
import { ProductDetailView } from "./components/ProductDetailView";
import { AssistantView } from "./components/AssistantView";
import { CompareView } from "./components/CompareView";
import { DashboardView } from "./components/DashboardView";
import { AdminView } from "./components/AdminView";
import { CartDrawer } from "./components/CartDrawer";
import { AuthModal } from "./components/AuthModal";

const EMPTY_CART: CartPayload = {
  cartId: 0,
  activeItems: [],
  savedItems: [],
  count: 0,
  subtotal: 0,
  discountTotal: 0,
  shippingTotal: 0,
  total: 0,
};

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("sg_theme");
    return saved === "light" ? "light" : "dark";
  });

  const [view, setView] = useState<AppView>("home");
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const [recommended, setRecommended] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [bestDeals, setBestDeals] = useState<Product[]>([]);
  const [mostPopular, setMostPopular] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const [cart, setCart] = useState<CartPayload>(EMPTY_CART);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  // View parameters
  const [selectedProductKey, setSelectedProductKey] = useState<string | number | null>(null);
  const [catalogCategory, setCatalogCategory] = useState<string>("all");
  const [catalogQuery, setCatalogQuery] = useState<string>("");
  const [assistantPrompt, setAssistantPrompt] = useState<string>("");
  const [assistantProduct, setAssistantProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sg_theme", theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? "" : curr));
    }, 3200);
  };

  const loadCoreData = async () => {
    try {
      const [meRes, metaRes, prodRes, recRes, cartRes] = await Promise.all([
        apiRequest<{ user: User | null }>("/api/auth/me"),
        apiRequest<{ categories: Category[]; brands: Brand[]; announcements: Announcement[] }>("/api/catalog/meta"),
        apiRequest<{ products: Product[] }>("/api/products"),
        apiRequest<{
          recommendedForYou: Product[];
          trending: Product[];
          bestDeals: Product[];
          mostPopular: Product[];
          recentlyViewed: Product[];
        }>("/api/recommendations"),
        apiRequest<CartPayload>("/api/cart"),
      ]);

      setUser(meRes.user);
      setCategories(metaRes.categories);
      setBrands(metaRes.brands);
      setAnnouncements(metaRes.announcements);
      setAllProducts(prodRes.products);
      setRecommended(recRes.recommendedForYou);
      setTrending(recRes.trending);
      setBestDeals(recRes.bestDeals);
      setMostPopular(recRes.mostPopular);
      setRecentlyViewed(recRes.recentlyViewed);
      setCart(cartRes);

      if (meRes.user) {
        const wl = await apiRequest<{ items: { product_id: number }[] }>("/api/wishlist");
        setWishlistIds(wl.items.map((w) => w.product_id));
      } else {
        setWishlistIds([]);
      }
    } catch {
      // Initial load resilient guard
    }
  };

  useEffect(() => {
    loadCoreData();
  }, []);

  const handleNavigate = (nextView: AppView) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductKey(product.slug || product.id);
    handleNavigate("product");
  };

  const handleAddToCart = async (product: Product, storeId?: number) => {
    const updated = await apiRequest<CartPayload>("/api/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId: product.id, quantity: 1, storeId }),
    });
    setCart(updated);
    showToast(`Added ${product.name || "item"} to your cart.`);
  };

  const handleToggleWishlist = async (product: Product) => {
    if (!user) {
      setAuthOpen(true);
      showToast("Sign in to save favourite products.");
      return;
    }
    const exists = wishlistIds.includes(product.id);
    if (exists) {
      await apiRequest(`/api/wishlist/${product.id}`, { method: "DELETE" });
      setWishlistIds((prev) => prev.filter((id) => id !== product.id));
      showToast("Removed from wishlist.");
    } else {
      await apiRequest("/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      });
      setWishlistIds((prev) => [...prev, product.id]);
      showToast(`Saved ${product.name} to wishlist.`);
    }
  };

  const handleToggleCompare = (product: Product) => {
    setCompareIds((prev) => {
      if (prev.includes(product.id)) {
        return prev.filter((id) => id !== product.id);
      }
      if (prev.length >= 3) {
        showToast("Compare up to 3 products at once.");
        return [...prev.slice(1), product.id];
      }
      showToast(`Added ${product.name} to comparison.`);
      return [...prev, product.id];
    });
  };

  const handleAskAI = (product?: Product, prompt?: string) => {
    setAssistantProduct(product || null);
    setAssistantPrompt(prompt || "");
    handleNavigate("assistant");
  };

  const handleOpenCatalog = (category = "all", query = "") => {
    setCatalogCategory(category);
    setCatalogQuery(query);
    handleNavigate("catalog");
  };

  const handleLogout = async () => {
    await apiRequest("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("sg_token");
    setUser(null);
    setWishlistIds([]);
    loadCoreData();
    handleNavigate("home");
    showToast("Signed out.");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100 transition-colors">
      <Navbar
        currentView={view}
        onNavigate={handleNavigate}
        cartCount={cart.count}
        onOpenCart={() => setCartOpen(true)}
        user={user}
        onOpenAuth={() => setAuthOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <main>
        {view === "home" && (
          <HomeView
            recommended={recommended}
            trending={trending}
            bestDeals={bestDeals}
            mostPopular={mostPopular}
            recentlyViewed={recentlyViewed}
            allProducts={allProducts}
            categories={categories}
            brands={brands}
            announcements={announcements}
            wishlistIds={wishlistIds}
            compareIds={compareIds}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onToggleCompare={handleToggleCompare}
            onAskAI={handleAskAI}
            onOpenCatalog={handleOpenCatalog}
          />
        )}

        {view === "catalog" && (
          <CatalogView
            categories={categories}
            brands={brands}
            initialCategory={catalogCategory}
            initialQuery={catalogQuery}
            wishlistIds={wishlistIds}
            compareIds={compareIds}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onToggleCompare={handleToggleCompare}
            onAskAI={handleAskAI}
          />
        )}

        {view === "product" && selectedProductKey && (
          <ProductDetailView
            productIdOrSlug={selectedProductKey}
            wishlistIds={wishlistIds}
            compareIds={compareIds}
            onBack={() => handleNavigate("catalog")}
            onSelectProduct={handleSelectProduct}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            onToggleCompare={handleToggleCompare}
            onAskAI={handleAskAI}
          />
        )}

        {view === "assistant" && (
          <AssistantView
            initialPrompt={assistantPrompt}
            productContext={assistantProduct}
            onClearInitialPrompt={() => setAssistantPrompt("")}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(p) => handleAddToCart(p)}
          />
        )}

        {view === "compare" && (
          <CompareView
            allProducts={allProducts}
            compareIds={compareIds}
            user={user}
            onSetCompareIds={setCompareIds}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(p) => handleAddToCart(p)}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        {view === "dashboard" && (
          <DashboardView
            user={user}
            categories={categories}
            brands={brands}
            recommended={recommended}
            wishlistIds={wishlistIds}
            compareIds={compareIds}
            onOpenAuth={() => setAuthOpen(true)}
            onUserUpdated={(u) => setUser(u)}
            onLogout={handleLogout}
            onSelectProduct={handleSelectProduct}
            onAddToCart={(p) => handleAddToCart(p)}
            onToggleWishlist={handleToggleWishlist}
            onToggleCompare={handleToggleCompare}
            onAskAI={handleAskAI}
            onOpenCompare={(ids) => {
              setCompareIds(ids);
              handleNavigate("compare");
            }}
          />
        )}

        {view === "admin" && <AdminView user={user} onCatalogMutated={loadCoreData} />}
      </main>

      {/* Compact Compare Floating Trigger when >=2 items selected */}
      {compareIds.length >= 2 && view !== "compare" && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={() => handleNavigate("compare")}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Scale className="w-4 h-4" />
            <span>Compare {compareIds.length} Selected Products</span>
          </button>
        </div>
      )}

      {/* Subtle Action Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium shadow-xl border border-slate-700">
          {toast}
        </div>
      )}

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onCartUpdated={(c) => setCart(c)}
        user={user}
      />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          loadCoreData();
          showToast(`Welcome, ${u.name}`);
        }}
      />
    </div>
  );
}
