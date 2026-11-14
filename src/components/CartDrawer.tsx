import { useState } from "react";
import type { FormEvent } from "react";
import { X, Plus, Minus, Trash2, Bookmark, ArrowRight, CheckCircle2 } from "lucide-react";
import type { CartPayload, User } from "../types";
import { SmartImage } from "./SmartImage";
import { apiRequest } from "../lib/api";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartPayload;
  onCartUpdated: (cart: CartPayload) => void;
  user: User | null;
}

interface OrderReceipt {
  order_number: string;
  total: number;
  status: string;
  customer_name: string;
  shipping_address: string;
}

export function CartDrawer({ isOpen, onClose, cart, onCartUpdated, user }: CartDrawerProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState(user?.name || "");
  const [customerEmail, setCustomerEmail] = useState(user?.email || "");
  const [shippingAddress, setShippingAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  if (!isOpen) return null;

  const updateQty = async (itemId: number, quantity: number) => {
    const updated = await apiRequest<CartPayload>(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    });
    onCartUpdated(updated);
  };

  const toggleSaveForLater = async (itemId: number, savedForLater: boolean) => {
    const updated = await apiRequest<CartPayload>(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ savedForLater }),
    });
    onCartUpdated(updated);
  };

  const removeItem = async (itemId: number) => {
    const updated = await apiRequest<CartPayload>(`/api/cart/items/${itemId}`, {
      method: "DELETE",
    });
    onCartUpdated(updated);
  };

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await apiRequest<{ order: OrderReceipt; cart: CartPayload }>("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName || user?.name,
          customerEmail: customerEmail || user?.email,
          shippingAddress,
          paymentMethod: "Demo Order Reservation (No Payment Processed)",
        }),
      });
      onCartUpdated(res.cart);
      setReceipt(res.order);
      setCheckoutOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-[#0E1525] border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Shopping Cart ({cart.count})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Demo catalog pricing · Persistent across sessions
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              onClose();
            }}
            aria-label="Close cart"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {receipt ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Order #{receipt.order_number} Confirmed</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Status: {receipt.status}. Recorded for {receipt.customer_name} shipping to {receipt.shipping_address}.
              </p>
              <p className="font-mono text-base font-semibold text-slate-900 dark:text-white tabular-nums">
                Total Reserved: ${receipt.total.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Note: This is a local demonstration order reservation. No external payment processor was charged.
              </p>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          ) : cart.activeItems.length === 0 && cart.savedItems.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Your shopping cart is empty
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Browse the catalog or ask the AI Assistant to find products that fit your needs.
              </p>
            </div>
          ) : (
            <>
              {/* Active Cart Items */}
              <div className="space-y-4">
                {cart.activeItems.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80"
                  >
                    <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                      <SmartImage imageKey={item.image_key} alt={item.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.store_name} · ${item.unit_price.toFixed(2)}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg">
                          <button
                            type="button"
                            onClick={() => updateQty(item.item_id, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.item_id, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSaveForLater(item.item_id, true)}
                            className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.item_id)}
                            aria-label={`Remove ${item.name}`}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Saved for Later */}
              {cart.savedItems.length > 0 && (
                <div className="pt-2 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Saved for Later ({cart.savedItems.length})
                  </h3>
                  {cart.savedItems.map((item) => (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800/60"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                        <p className="text-xs font-mono text-slate-500 tabular-nums">${item.unit_price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSaveForLater(item.item_id, false)}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Move to Cart
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.item_id)}
                          aria-label="Delete saved item"
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Checkout Form */}
              {checkoutOpen && cart.activeItems.length > 0 && (
                <form onSubmit={handleCheckout} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Demo Order Reservation Details
                  </h3>
                  {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  <textarea
                    required
                    rows={2}
                    placeholder="Shipping Address, City, Postal Code"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Records a demo order reservation locally without charging a payment card.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Reserving Order..." : `Confirm Demo Order ($${cart.total.toFixed(2)})`}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer Totals */}
        {cart.activeItems.length > 0 && !receipt && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] space-y-2.5">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <span>Subtotal</span>
              <span className="font-mono">${cart.subtotal.toFixed(2)}</span>
            </div>
            {cart.discountTotal > 0 && (
              <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                <span>Verified Store Savings</span>
                <span className="font-mono">-${cart.discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <span>Shipping</span>
              <span className="font-mono">{cart.shippingTotal === 0 ? "Free" : `$${cart.shippingTotal.toFixed(2)}`}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-base font-semibold text-slate-900 dark:text-white tabular-nums">
              <span>Total</span>
              <span className="font-mono">${cart.total.toFixed(2)}</span>
            </div>

            {!checkoutOpen && (
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    if (!customerName) setCustomerName(user.name);
                    if (!customerEmail) setCustomerEmail(user.email);
                  }
                  setCheckoutOpen(true);
                }}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Proceed to Demo Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
