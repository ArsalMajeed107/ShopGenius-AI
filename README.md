# ShopGenius AI

**Intelligent Shopping, Personalized for You.**

ShopGenius AI is a full-stack AI-powered e-commerce discovery and price-comparison platform. Built with React, TypeScript, Tailwind CSS, Express, Node SQLite, and the `@google/genai` SDK (`gemini-4-hydrogen`), it pairs a modern dual-theme storefront with a grounded AI Shopping Assistant, Natural Language Smart Search, Multi-Store Price Comparison Engine, AI Review Analyzer, Customer Dashboard, and Admin Console.

---

## Key Features

- **AI Shopping Assistant (`/api/ai/chat`)**: Conversational Gemini 4 agent equipped with server-side catalog function-calling tools (`search_catalog_products`, `get_product_details_and_prices`, `compare_multiple_products`). Retrieves real database products, specs, and offers rather than inventing prices.
- **Smart Product Search (`/api/ai/smart-search`)**: Parses natural-language queries (e.g., *"Find me the best laptop under $800"*) into structured category, brand, price, and sort filters.
- **Smart Price Comparison**: Compares current prices, previous prices, verified discounts, shipping costs, availability, and verification timestamps across demonstration stores, highlighting the lowest total offer.
- **AI Product Review Analyzer (`/api/ai/analyze-reviews/:id`)**: Synthesizes customer reviews into sentiment score, strengths, weaknesses, common complaints, and frequently mentioned features—kept distinct from original customer reviews.
- **Smart Shopping Cart & Demo Checkout**: Persistent guest and authenticated carts, quantity steppers, save-for-later, verified discount calculation, and local demonstration order reservation.
- **User & Admin Dashboards**: Preference learning controls (view, edit, reset), wishlist tracking, conversation history, catalog CRUD, store price updates, review moderation, and AI usage telemetry.

---

## Demonstration Accounts

- **Demo Customer**: `demo@shopgenius.ai` / `ShopDemo2026!`
- **Demo Admin**: `admin@shopgenius.ai` / `AdminGenius2026!`

> All product listings, store prices, and checkout reservations use realistic demonstration catalog data stored in `shopgenius.db`.

---

## Local Setup (VS Code / Terminal)

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `.env` and add your Gemini API key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   SESSION_SECRET="your-random-session-secret"
   ```
3. **Run in development mode** (Express + Vite HMR middleware on port 3000):
   ```bash
   npm run dev
   ```
4. **Typecheck, Build & Production Start**:
   ```bash
   npm run lint
   npm run build
   NODE_ENV=production npm start
   ```
