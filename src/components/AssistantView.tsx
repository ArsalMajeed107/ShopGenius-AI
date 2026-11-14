import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Send, Plus, Trash2, MessageSquare, ShoppingBag, ArrowUpRight } from "lucide-react";
import type { ChatMessage, Conversation, Product } from "../types";
import { apiRequest } from "../lib/api";
import { SmartImage } from "./SmartImage";

interface AssistantViewProps {
  initialPrompt?: string;
  productContext?: Product | null;
  onClearInitialPrompt: () => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

const STARTER_PROMPTS = [
  "Find me the best laptop under $800",
  "Recommend a smartphone with a good camera",
  "Show me the best gaming laptops",
  "Find affordable wireless headphones",
  "Compare iPhone and Samsung smartphones",
  "Suggest a laptop for AI and machine learning",
];

export function AssistantView({
  initialPrompt,
  productContext,
  onClearInitialPrompt,
  onSelectProduct,
  onAddToCart,
}: AssistantViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const res = await apiRequest<{ conversations: Conversation[] }>("/api/ai/conversations");
    setConversations(res.conversations);
    return res.conversations;
  };

  const loadMessages = async (convId: number) => {
    const res = await apiRequest<{ messages: ChatMessage[] }>(`/api/ai/conversations/${convId}/messages`);
    setMessages(res.messages);
  };

  useEffect(() => {
    loadConversations().then((convs) => {
      if (initialPrompt && initialPrompt.trim()) {
        // Start a fresh conversation for incoming contextual prompt
        sendMessageText(initialPrompt.trim(), null);
        onClearInitialPrompt();
      } else if (convs.length > 0 && !activeConvId) {
        setActiveConvId(convs[0].id);
        loadMessages(convs[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && conversations.length >= 0) {
      // Handle subsequent triggers while mounted
    }
  }, [initialPrompt, conversations.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const startNewChat = async () => {
    setActiveConvId(null);
    setMessages([]);
    setError("");
  };

  const deleteConversation = async (id: number) => {
    await apiRequest(`/api/ai/conversations/${id}`, { method: "DELETE" });
    const next = conversations.filter((c) => c.id !== id);
    setConversations(next);
    if (activeConvId === id) {
      if (next.length > 0) {
        setActiveConvId(next[0].id);
        loadMessages(next[0].id);
      } else {
        setActiveConvId(null);
        setMessages([]);
      }
    }
  };

  const sendMessageText = async (text: string, convIdOverride?: number | null) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const targetConvId = convIdOverride !== undefined ? convIdOverride : activeConvId;
    setError("");
    setSending(true);
    setInput("");

    const optimisticUser: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = await apiRequest<{
        conversationId: number;
        reply: string;
        products: Product[];
        followUpSuggestions: string[];
        toolSummary: string;
      }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: targetConvId ?? undefined,
          message: trimmed,
          productContextId: productContext?.id,
        }),
      });

      setActiveConvId(res.conversationId);
      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: res.reply,
        products: res.products,
        followUpSuggestions: res.followUpSuggestions,
        toolSummary: res.toolSummary,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach AI Assistant.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessageText(input);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[72vh]">
        {/* Left Sidebar: Conversation History */}
        <aside className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-col gap-4">
          <button
            type="button"
            onClick={startNewChat}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Shopping Chat</span>
          </button>

          <div className="space-y-1 flex-1 overflow-y-auto max-h-[54vh]">
            <p className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Conversation History
            </p>
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500 dark:text-slate-400">
                No previous conversations yet. Ask a shopping question to begin.
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeConvId === conv.id
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                  }`}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    loadMessages(conv.id);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {productContext && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Product Context</p>
              <button
                type="button"
                onClick={() => onSelectProduct(productContext)}
                className="w-full text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate cursor-pointer"
              >
                {productContext.name} (${productContext.lowest_price})
              </button>
            </div>
          )}
        </aside>

        {/* Main Chat Workspace */}
        <section className="lg:col-span-9 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                ShopGenius AI Shopping Assistant
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grounded in real catalog specs, multi-store prices, and customer reviews via Gemini 4 tool calling
              </p>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[60vh]">
            {messages.length === 0 ? (
              <div className="py-8 max-w-2xl mx-auto space-y-6">
                <div className="space-y-2">
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                    What are you shopping for today?
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Ask in natural language about budgets, camera quality, battery life, machine learning specs, or compare competing devices side-by-side.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessageText(prompt)}
                      className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-500 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} space-y-3`}>
                  <div
                    className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {msg.content}
                    {msg.toolSummary && (
                      <p className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {msg.toolSummary}
                      </p>
                    )}
                  </div>

                  {/* Embedded Grounded Product Cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {msg.products.map((prod) => (
                        <div
                          key={prod.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1525] p-3 flex gap-3 items-center"
                        >
                          <div
                            onClick={() => onSelectProduct(prod)}
                            className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer"
                          >
                            <SmartImage imageKey={prod.image_key} alt={prod.name} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => onSelectProduct(prod)}
                              className="text-left text-xs font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block w-full cursor-pointer"
                            >
                              {prod.name}
                            </button>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {prod.brand_name} · {prod.rating.toFixed(1)}/5
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                ${prod.lowest_price}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onSelectProduct(prod)}
                                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  title="View product details"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAddToCart(prod)}
                                  className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                                >
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>Add</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Follow-up Suggestions */}
                  {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-w-3xl">
                      {msg.followUpSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendMessageText(s)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Checking catalog specifications and comparing store prices...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for recommendations, price checks, or product comparisons..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
