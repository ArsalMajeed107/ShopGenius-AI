import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "shopgenius.db");
export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      avatar_url TEXT DEFAULT '',
      email_verified INTEGER NOT NULL DEFAULT 1,
      verification_token TEXT DEFAULT '',
      reset_token TEXT DEFAULT '',
      reset_expires INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      country TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      trust_rating REAL NOT NULL DEFAULT 4.8,
      shipping_policy TEXT NOT NULL DEFAULT 'Free shipping over $50',
      is_demo_source INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      brand_id INTEGER NOT NULL REFERENCES brands(id),
      description TEXT NOT NULL,
      specs_json TEXT NOT NULL DEFAULT '{}',
      image_key TEXT NOT NULL,
      gallery_keys_json TEXT NOT NULL DEFAULT '[]',
      base_price REAL NOT NULL,
      rating REAL NOT NULL DEFAULT 4.5,
      review_count INTEGER NOT NULL DEFAULT 0,
      popularity_score INTEGER NOT NULL DEFAULT 50,
      in_stock INTEGER NOT NULL DEFAULT 1,
      stock_count INTEGER NOT NULL DEFAULT 25,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      current_price REAL NOT NULL,
      previous_price REAL,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      shipping_cost REAL NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT 'In Stock',
      product_url TEXT NOT NULL,
      last_verified_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      verified_purchase INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_analyses (
      product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      overall_sentiment TEXT NOT NULL,
      sentiment_score INTEGER NOT NULL,
      positive_feedback_json TEXT NOT NULL,
      negative_feedback_json TEXT NOT NULL,
      common_complaints_json TEXT NOT NULL,
      strengths_json TEXT NOT NULL,
      weaknesses_json TEXT NOT NULL,
      features_json TEXT NOT NULL,
      summary TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopping_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      saved_for_later INTEGER NOT NULL DEFAULT 0,
      selected_store_id INTEGER REFERENCES stores(id),
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      collection_name TEXT NOT NULL DEFAULT 'Saved Favorites',
      target_price REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS browsing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      query TEXT NOT NULL,
      filters_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      interests_json TEXT NOT NULL DEFAULT '[]',
      preferred_categories_json TEXT NOT NULL DEFAULT '[]',
      preferred_brands_json TEXT NOT NULL DEFAULT '[]',
      min_budget REAL NOT NULL DEFAULT 0,
      max_budget REAL NOT NULL DEFAULT 2500,
      learned_keywords_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      title TEXT NOT NULL DEFAULT 'New Shopping Session',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      recommended_product_ids_json TEXT NOT NULL DEFAULT '[]',
      tool_summary TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      product_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_id TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_total REAL NOT NULL DEFAULT 0,
      shipping_total REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Demo Checkout Reservation',
      status TEXT NOT NULL DEFAULT 'Order Recorded (Demo)',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      feature TEXT NOT NULL,
      query_preview TEXT NOT NULL DEFAULT '',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const existingCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;
  if (existingCount > 0) return;

  // Seed Users
  const demoPass = bcrypt.hashSync("ShopDemo2026!", 10);
  const adminPass = bcrypt.hashSync("AdminGenius2026!", 10);

  db.prepare(
    "INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)"
  ).run("Maya Lin", "demo@shopgenius.ai", demoPass, "customer");

  db.prepare(
    "INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)"
  ).run("Alex Rivera", "admin@shopgenius.ai", adminPass, "admin");

  db.prepare(
    `INSERT INTO user_preferences (user_id, interests_json, preferred_categories_json, preferred_brands_json, min_budget, max_budget, learned_keywords_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    1,
    JSON.stringify(["Ultrabooks", "Noise-Canceling Audio", "Mobile Photography"]),
    JSON.stringify(["Laptops", "Audio", "Smartphones"]),
    JSON.stringify(["AeroBook", "Sonix", "Apple"]),
    100,
    1500,
    JSON.stringify(["battery life", "lightweight", "camera quality", "under $800"])
  );

  // Categories
  const categoryList = [
    { name: "Laptops", slug: "laptops", description: "Ultrabooks, creator workstations, and gaming notebooks" },
    { name: "Smartphones", slug: "smartphones", description: "Flagship mobile devices and camera-first smartphones" },
    { name: "Audio", slug: "audio", description: "Noise-canceling headphones and wireless studio earbuds" },
    { name: "Wearables", slug: "wearables", description: "Titanium smartwatches and fitness trackers" },
    { name: "Cameras", slug: "cameras", description: "Mirrorless bodies and compact prime optics" }
  ];
  const insertCat = db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)");
  for (const c of categoryList) insertCat.run(c.name, c.slug, c.description);

  // Brands
  const brandList = [
    { name: "AeroBook", slug: "aerobook", country: "USA" },
    { name: "VoltTech", slug: "volttech", country: "Taiwan" },
    { name: "Apple", slug: "apple", country: "USA" },
    { name: "Samsung", slug: "samsung", country: "South Korea" },
    { name: "Sonix", slug: "sonix", country: "Japan" },
    { name: "Chronos", slug: "chronos", country: "Switzerland" },
    { name: "OpticCore", slug: "opticcore", country: "Germany" }
  ];
  const insertBrand = db.prepare("INSERT INTO brands (name, slug, country) VALUES (?, ?, ?)");
  for (const b of brandList) insertBrand.run(b.name, b.slug, b.country);

  // Stores (clearly marked as demonstration data sources)
  const storeList = [
    { name: "ShopGenius Direct (Demo)", domain: "direct.shopgenius.demo", trust: 4.9, shipping: "Free 2-day shipping" },
    { name: "TechVault Retail (Demo)", domain: "techvault.demo", trust: 4.7, shipping: "Free shipping over $99" },
    { name: "Apex Electronics (Demo)", domain: "apexelectronics.demo", trust: 4.8, shipping: "$9.99 standard or free over $150" },
    { name: "Horizon Prime (Demo)", domain: "horizonprime.demo", trust: 4.6, shipping: "Free standard delivery" }
  ];
  const insertStore = db.prepare(
    "INSERT INTO stores (name, domain, trust_rating, shipping_policy, is_demo_source) VALUES (?, ?, ?, ?, 1)"
  );
  for (const s of storeList) insertStore.run(s.name, s.domain, s.trust, s.shipping);

  // Helper lookup maps
  const catId = (slug: string) => (db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug) as { id: number }).id;
  const brandId = (slug: string) => (db.prepare("SELECT id FROM brands WHERE slug = ?").get(slug) as { id: number }).id;

  const productsSeed = [
    {
      sku: "SG-LAP-140",
      name: "AeroBook Lite 14 Ultrabook",
      slug: "aerobook-lite-14",
      cat: "laptops",
      brand: "aerobook",
      desc: "Precision-milled aluminum 14-inch ultrabook built for everyday productivity, coding, and travel. Delivers up to 16 hours of battery life with a crisp 2.5K anti-glare IPS panel and quiet thermal architecture under $800.",
      specs: {
        Processor: "Ryzen 7 8840U (8-Core, 5.1 GHz)",
        Memory: "16GB LPDDR5X-6400",
        Storage: "512GB PCIe Gen4 NVMe SSD",
        Display: "14.0\" 2560x1600 IPS, 400 nits, 100% sRGB",
        Weight: "1.24 kg (2.73 lbs)",
        Battery: "Up to 16 hours mixed use"
      },
      image_key: "laptop_pro",
      gallery: ["laptop_pro", "hero", "gaming_laptop"],
      base_price: 749,
      rating: 4.8,
      popularity: 96,
      stock: 34,
      featured: 1,
      trending: 1,
      prices: [
        { store: 1, price: 729, prev: 799, disc: 9, ship: 0, avail: "In Stock" },
        { store: 2, price: 749, prev: 799, disc: 6, ship: 0, avail: "In Stock" },
        { store: 3, price: 765, prev: null, disc: 0, ship: 0, avail: "Low Stock" }
      ],
      reviews: [
        { author: "Daniel K.", rating: 5, title: "Best value coding laptop under $800", comment: "Compiles TypeScript and Rust quickly without throttling. Battery genuinely lasts through a full workday and train commute. Keyboard travel feels crisp." },
        { author: "Priya S.", rating: 5, title: "Featherweight with an accurate screen", comment: "The 16:10 display is sharp for spreadsheets and Figma. Speakers are decent for calls, though bass is light. Zero flex in the lid." },
        { author: "Marcus T.", rating: 4, title: "Great daily driver, slightly warm on lap during renders", comment: "For web browsing and office work it is dead silent. When exporting long 4K clips the bottom gets noticeably warm, though fans remain quiet." }
      ]
    },
    {
      sku: "SG-LAP-160",
      name: "AeroBook Studio ML Pro 16",
      slug: "aerobook-studio-ml-pro-16",
      cat: "laptops",
      brand: "aerobook",
      desc: "High-memory AI and machine learning mobile workstation featuring 64GB unified memory, dedicated Neural NPU acceleration, and dual vapor-chamber cooling for local model inference and data science.",
      specs: {
        Processor: "16-Core Neural Compute SoC + 32-Core GPU",
        Memory: "64GB Unified High-Bandwidth Memory (400 GB/s)",
        Storage: "2TB PCIe Gen4 NVMe SSD",
        Display: "16.2\" Mini-LED 3456x2234, 120Hz ProMotion",
        Weight: "2.1 kg (4.6 lbs)",
        Battery: "Up to 18 hours"
      },
      image_key: "laptop_pro",
      gallery: ["laptop_pro", "gaming_laptop", "hero"],
      base_price: 2299,
      rating: 4.9,
      popularity: 92,
      stock: 14,
      featured: 1,
      trending: 0,
      prices: [
        { store: 1, price: 2249, prev: 2499, disc: 10, ship: 0, avail: "In Stock" },
        { store: 2, price: 2299, prev: 2499, disc: 8, ship: 0, avail: "In Stock" },
        { store: 4, price: 2349, prev: null, disc: 0, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Dr. Elena Vance", rating: 5, title: "Runs 30B quantized models effortlessly", comment: "Having 64GB unified memory on a laptop changes local ML prototyping completely. Display color calibration out of the box is studio-grade." },
        { author: "Kenji W.", rating: 5, title: "Silent under Python/PyTorch loads", comment: "Battery life stays solid even when running containerized training notebooks. Expensive, but replaces my desktop tower." },
        { author: "Samir H.", rating: 4, title: "Heavy in a backpack", comment: "Performance and battery life are unmatched, though at 2.1 kg plus charger it is definitely built for desk-to-studio commutes rather than ultraportable travel." }
      ]
    },
    {
      sku: "SG-GAM-165",
      name: "VoltTech Titan RTX 16 Gaming Laptop",
      slug: "volttech-titan-rtx-16",
      cat: "laptops",
      brand: "volttech",
      desc: "High-refresh 240Hz QHD+ gaming laptop powered by an RTX 4070 Laptop GPU and per-key optical switches, engineered for competitive frame rates and smooth ray-traced rendering.",
      specs: {
        Processor: "Core i9-14900HX (24-Core)",
        Graphics: "NVIDIA GeForce RTX 4070 8GB GDDR6 (140W)",
        Memory: "32GB DDR5-5600",
        Storage: "1TB NVMe Gen4 SSD",
        Display: "16.0\" 2560x1600 240Hz 3ms G-Sync",
        Cooling: "Liquid Metal + Tri-Fan Exhaust"
      },
      image_key: "gaming_laptop",
      gallery: ["gaming_laptop", "laptop_pro"],
      base_price: 1649,
      rating: 4.7,
      popularity: 94,
      stock: 19,
      featured: 1,
      trending: 1,
      prices: [
        { store: 2, price: 1589, prev: 1799, disc: 12, ship: 0, avail: "In Stock" },
        { store: 1, price: 1629, prev: 1799, disc: 9, ship: 0, avail: "In Stock" },
        { store: 3, price: 1649, prev: 1799, disc: 8, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Liam O.", rating: 5, title: "240Hz panel is razor sharp", comment: "Hits 140+ FPS in AAA titles at native QHD+ with DLSS. Chassis looks clean enough for work meetings when the backlight is set to white." },
        { author: "Noah B.", rating: 4, title: "Great frame rates, loud fans in Turbo mode", comment: "GPU thermals stay under 76C which is impressive, but expect noticeable fan noise in Turbo profile. Battery lasts around 4.5 hours off-plug." },
        { author: "Chloe M.", rating: 5, title: "Upgradeable RAM and second M.2 slot", comment: "Added a second 2TB SSD in five minutes. Best price-to-FPS gaming laptop in this bracket." }
      ]
    },
    {
      sku: "SG-PHN-16P",
      name: "Apple iPhone 16 Pro (256GB)",
      slug: "apple-iphone-16-pro",
      cat: "smartphones",
      brand: "apple",
      desc: "Grade 5 titanium flagship smartphone with 48MP Fusion and 5x tetraprism telephoto camera system, 4K 120fps Dolby Vision video, and A18 Pro silicon.",
      specs: {
        Display: "6.3\" Super Retina XDR OLED, 120Hz ProMotion",
        Chipset: "A18 Pro (6-Core CPU / 6-Core GPU)",
        Camera: "48MP Main + 48MP Ultra Wide + 12MP 5x Telephoto",
        Storage: "256GB NVMe",
        Build: "Brushed Titanium, Ceramic Shield",
        Connectivity: "USB-C (10Gb/s), Wi-Fi 7, 5G"
      },
      image_key: "smartphone",
      gallery: ["smartphone", "hero"],
      base_price: 999,
      rating: 4.9,
      popularity: 99,
      stock: 42,
      featured: 1,
      trending: 1,
      prices: [
        { store: 1, price: 969, prev: 999, disc: 3, ship: 0, avail: "In Stock" },
        { store: 2, price: 989, prev: 999, disc: 1, ship: 0, avail: "In Stock" },
        { store: 4, price: 999, prev: null, disc: 0, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Hannah R.", rating: 5, title: "Best video camera on any phone", comment: "ProRAW stills and 4K120 log video look remarkably natural. Battery easily gets me to midnight with 30% left." },
        { author: "Victor Z.", rating: 5, title: "Compact flagship feel", comment: "The 6.3-inch screen hits the sweet spot for one-handed typing without sacrificing the 5x optical zoom lens." },
        { author: "Owen P.", rating: 4, title: "Charging speed lags behind competitors", comment: "Camera consistency and ecosystem integration are top tier, though wired charging takes longer than some Android flagships." }
      ]
    },
    {
      sku: "SG-PHN-S25",
      name: "Samsung Galaxy S25 Ultra (256GB)",
      slug: "samsung-galaxy-s25-ultra",
      cat: "smartphones",
      brand: "samsung",
      desc: "Titanium powerhouse smartphone featuring a 200MP quad-telephoto camera array, anti-reflective QHD+ AMOLED display, built-in S Pen precision stylus, and Snapdragon Elite processing.",
      specs: {
        Display: "6.8\" Dynamic AMOLED 2X QHD+, 120Hz, Anti-Reflective",
        Chipset: "Snapdragon 8 Elite for Galaxy",
        Camera: "200MP Wide + 50MP Ultra Wide + 50MP 5x + 10MP 3x",
        Storage: "256GB UFS 4.0",
        Battery: "5000 mAh, 45W Wired + Wireless",
        Extras: "Integrated S Pen, IP68"
      },
      image_key: "smartphone",
      gallery: ["smartphone", "hero"],
      base_price: 1149,
      rating: 4.8,
      popularity: 97,
      stock: 28,
      featured: 1,
      trending: 1,
      prices: [
        { store: 3, price: 1049, prev: 1299, disc: 19, ship: 0, avail: "In Stock" },
        { store: 1, price: 1099, prev: 1299, disc: 15, ship: 0, avail: "In Stock" },
        { store: 2, price: 1149, prev: 1299, disc: 12, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Tariq A.", rating: 5, title: "Unbeatable zoom and anti-glare glass", comment: "Shooting concerts at 5x and 10x gives usable sharp shots. The anti-reflective screen coating makes outdoor reading effortless." },
        { author: "Sofia G.", rating: 5, title: "S Pen and split-screen multitasking", comment: "Annotating PDFs on flights is seamless. Battery life easily clears 8 hours of screen-on time." },
        { author: "Ben L.", rating: 4, title: "Large footprint", comment: "Spectacular display and camera versatility, though it is heavy in slim jeans pockets and shutter lag on moving pets still shows up occasionally." }
      ]
    },
    {
      sku: "SG-AUD-149",
      name: "Sonix QuietWave ANC Wireless Headphones",
      slug: "sonix-quietwave-anc",
      cat: "audio",
      brand: "sonix",
      desc: "Affordable wireless over-ear headphones combining hybrid active noise cancellation, 45-hour battery endurance, multipoint Bluetooth 5.4, and memory-foam earcups under $150.",
      specs: {
        Drivers: "40mm Dynamic Bio-Cellulose",
        ANC: "Hybrid Adaptive ANC (-42 dB)",
        Battery: "45 hrs (ANC On) / 60 hrs (ANC Off)",
        Charging: "USB-C Fast Charge (10 min = 5 hrs)",
        Codecs: "AAC, SBC, LDAC",
        Weight: "238g"
      },
      image_key: "headphones",
      gallery: ["headphones", "earbuds"],
      base_price: 149,
      rating: 4.7,
      popularity: 95,
      stock: 60,
      featured: 1,
      trending: 1,
      prices: [
        { store: 1, price: 129, prev: 169, disc: 24, ship: 0, avail: "In Stock" },
        { store: 4, price: 139, prev: 169, disc: 18, ship: 0, avail: "In Stock" },
        { store: 2, price: 149, prev: 169, disc: 12, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Claire D.", rating: 5, title: "Punishes headphones twice the price", comment: "Bought these for daily subway commutes. Cuts low engine rumble impressively and multipoint switching between my laptop and phone works reliably." },
        { author: "Evan J.", rating: 4, title: "Great comfort and battery, plastic hinges", comment: "Sound signature has punchy bass and clear vocals after dialing EQ in the app. Folding hinges feel mostly plastic, so use the included travel pouch." },
        { author: "Nadia M.", rating: 5, title: "45-hour battery is real", comment: "Charged once two weeks ago and still at 35% after daily office wear." }
      ]
    },
    {
      sku: "SG-AUD-349",
      name: "Sonix Studio Reference M2 Wireless",
      slug: "sonix-studio-reference-m2",
      cat: "audio",
      brand: "sonix",
      desc: "Audiophile-tuned wireless ANC headphones with machined aluminum yokes, lossless USB-C DAC playback, spatial head tracking, and studio-grade acoustic clarity.",
      specs: {
        Drivers: "45mm Beryllium-Coated Dynamic",
        ANC: "8-Mic Adaptive Pro ANC",
        Battery: "38 hrs (ANC On)",
        Connectivity: "Bluetooth 5.4 (aptX Lossless / LDAC) + USB-C Audio",
        Materials: "Brushed Aluminum & Lambskin Memory Foam",
        Weight: "285g"
      },
      image_key: "headphones",
      gallery: ["headphones", "hero"],
      base_price: 349,
      rating: 4.9,
      popularity: 88,
      stock: 22,
      featured: 0,
      trending: 1,
      prices: [
        { store: 2, price: 319, prev: 379, disc: 16, ship: 0, avail: "In Stock" },
        { store: 1, price: 329, prev: 379, disc: 13, ship: 0, avail: "In Stock" },
        { store: 3, price: 349, prev: null, disc: 0, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Julian F.", rating: 5, title: "Detail retrieval over USB-C is remarkable", comment: "Finally a wireless headphone that does not bloat the mid-bass. Build quality feels heirloom-grade." },
        { author: "Rachel T.", rating: 5, title: "Silent flights and crisp call mics", comment: "Voice isolation during airport calls actually blocks background announcements." }
      ]
    },
    {
      sku: "SG-EAR-119",
      name: "Sonix Pulse True Wireless Earbuds",
      slug: "sonix-pulse-earbuds",
      cat: "audio",
      brand: "sonix",
      desc: "Compact ceramic-matte earbuds with adaptive noise cancellation, IPX5 sweat resistance, wireless charging case, and low-latency audio sync.",
      specs: {
        Drivers: "11mm Dual-Magnet Dynamic",
        Battery: "9 hrs Buds + 27 hrs Case",
        Protection: "IPX5 Water & Sweat Resistant",
        Charging: "USB-C + Qi Wireless",
        Weight: "4.6g per earbud"
      },
      image_key: "earbuds",
      gallery: ["earbuds", "headphones"],
      base_price: 119,
      rating: 4.6,
      popularity: 84,
      stock: 48,
      featured: 0,
      trending: 0,
      prices: [
        { store: 1, price: 99, prev: 129, disc: 23, ship: 0, avail: "In Stock" },
        { store: 4, price: 115, prev: 129, disc: 11, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Devon C.", rating: 5, title: "Stays locked in during runs", comment: "Lighter than most ANC buds and the matte case never picks up scratches in my pocket." },
        { author: "Grace K.", rating: 4, title: "Solid value under $100 on sale", comment: "Transparency mode sounds natural. Touch controls take a day to memorize." }
      ]
    },
    {
      sku: "SG-WCH-549",
      name: "Chronos Titanium Watch Ultra",
      slug: "chronos-titanium-watch-ultra",
      cat: "wearables",
      brand: "chronos",
      desc: "Aerospace-grade titanium smartwatch featuring dual-frequency GPS, sapphire crystal display, 7-day endurance battery, and continuous HRV & sleep recovery analytics.",
      specs: {
        Case: "47mm Grade 5 Titanium + Sapphire Crystal",
        Display: "1.5\" LTPO AMOLED (2500 nits)",
        Battery: "Up to 7 Days Normal / 60 hrs GPS",
        WaterRating: "100m / EN13319 Dive Certified",
        Sensors: "Dual-Band GNSS, ECG, SpO2, Skin Temp"
      },
      image_key: "watch",
      gallery: ["watch", "hero"],
      base_price: 549,
      rating: 4.8,
      popularity: 89,
      stock: 17,
      featured: 1,
      trending: 0,
      prices: [
        { store: 1, price: 499, prev: 549, disc: 9, ship: 0, avail: "In Stock" },
        { store: 3, price: 529, prev: 549, disc: 4, ship: 0, avail: "In Stock" },
        { store: 2, price: 549, prev: null, disc: 0, ship: 0, avail: "Low Stock" }
      ],
      reviews: [
        { author: "Alex N.", rating: 5, title: "Week-long battery without losing smart features", comment: "Trail GPS tracks cleanly under dense tree cover and the woven alpine loop dries quickly after swims." },
        { author: "Tessa V.", rating: 4, title: "Chunky on smaller wrists", comment: "Build quality and screen brightness are stellar, though 47mm wears large if you have slender wrists." }
      ]
    },
    {
      sku: "SG-CAM-1399",
      name: "OpticCore Alpha Z7 Mirrorless + 35mm f/1.4",
      slug: "opticcore-alpha-z7-kit",
      cat: "cameras",
      brand: "opticcore",
      desc: "Full-frame 33MP mirrorless camera paired with a precision 35mm f/1.4 prime lens, 5-axis in-body stabilization, and 10-bit 4K60 internal recording.",
      specs: {
        Sensor: "33MP Full-Frame BSI CMOS",
        Stabilization: "5-Axis IBIS (7.0 Stops)",
        Autofocus: "759-Point AI Subject Detection",
        Video: "4K 60fps 10-bit 4:2:2 Internal",
        LensIncluded: "OpticCore 35mm f/1.4 Prime"
      },
      image_key: "camera",
      gallery: ["camera", "hero"],
      base_price: 1399,
      rating: 4.9,
      popularity: 86,
      stock: 9,
      featured: 0,
      trending: 1,
      prices: [
        { store: 2, price: 1349, prev: 1599, disc: 16, ship: 0, avail: "In Stock" },
        { store: 1, price: 1399, prev: 1599, disc: 13, ship: 0, avail: "In Stock" },
        { store: 3, price: 1449, prev: 1599, disc: 9, ship: 14.99, avail: "In Stock" }
      ],
      reviews: [
        { author: "Mateo R.", rating: 5, title: "Tactile dials and incredible low-light DR", comment: "The 35mm f/1.4 kit lens renders creamy bokeh and eye-AF locks instantly in dim cafes." },
        { author: "Iris P.", rating: 5, title: "Compact full-frame travel companion", comment: "Weather sealing held up in coastal mist. Menu system is straightforward." }
      ]
    },
    {
      sku: "SG-LAP-1199",
      name: "AeroBook Air M4 15-Inch",
      slug: "aerobook-air-m4-15",
      cat: "laptops",
      brand: "aerobook",
      desc: "Fanless 15-inch thin-and-light laptop combining silent all-day endurance, studio-calibrated Liquid display, and fast single-core responsiveness.",
      specs: {
        Processor: "M4 10-Core Architecture",
        Memory: "16GB Unified Memory",
        Storage: "512GB SSD",
        Display: "15.3\" 2880x1864 IPS, 500 nits",
        Weight: "1.48 kg",
        Battery: "Up to 18 hours"
      },
      image_key: "laptop_pro",
      gallery: ["laptop_pro", "hero"],
      base_price: 1199,
      rating: 4.8,
      popularity: 91,
      stock: 27,
      featured: 0,
      trending: 0,
      prices: [
        { store: 1, price: 1129, prev: 1249, disc: 10, ship: 0, avail: "In Stock" },
        { store: 4, price: 1199, prev: 1249, disc: 4, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Laura B.", rating: 5, title: "Zero fan noise, massive 15-inch workspace", comment: "Trackpad and battery life remain the gold standard for writing and multitasking." },
        { author: "Greg S.", rating: 4, title: "Only two USB-C ports", comment: "Light and fast, though you will want a compact hub if you plug in multiple monitors and SD cards." }
      ]
    },
    {
      sku: "SG-PHN-649",
      name: "VoltTech Vision 9 Camera Phone",
      slug: "volttech-vision-9",
      cat: "smartphones",
      brand: "volttech",
      desc: "Mid-range photography-focused smartphone with 1-inch type main sensor, clean Android experience, 120Hz OLED display, and rapid 65W charging under $650.",
      specs: {
        Display: "6.5\" 120Hz LTPO OLED",
        Camera: "50MP 1-inch Sensor + 48MP Telephoto",
        Memory: "12GB RAM / 256GB Storage",
        Battery: "4900 mAh, 65W Fast Charge"
      },
      image_key: "smartphone",
      gallery: ["smartphone"],
      base_price: 649,
      rating: 4.6,
      popularity: 81,
      stock: 31,
      featured: 0,
      trending: 0,
      prices: [
        { store: 1, price: 599, prev: 679, disc: 12, ship: 0, avail: "In Stock" },
        { store: 2, price: 629, prev: 679, disc: 7, ship: 0, avail: "In Stock" }
      ],
      reviews: [
        { author: "Kiran P.", rating: 5, title: "Flagship night photography at $599", comment: "Natural skin tones and minimal shutter lag. Charges from 10% to 85% in 22 minutes." },
        { author: "Maya H.", rating: 4, title: "Average video stabilization", comment: "Still photos rival $1,000 phones; 4K video is good in daylight but jittery while walking." }
      ]
    }
  ];

  const insertProd = db.prepare(`
    INSERT INTO products (sku, name, slug, category_id, brand_id, description, specs_json, image_key, gallery_keys_json, base_price, rating, review_count, popularity_score, in_stock, stock_count, is_featured, is_trending, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
  `);

  const insertPrice = db.prepare(`
    INSERT INTO product_prices (product_id, store_id, current_price, previous_price, discount_percent, shipping_cost, availability, product_url, last_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (product_id, author_name, rating, title, comment, verified_purchase)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const p of productsSeed) {
    const res = insertProd.run(
      p.sku,
      p.name,
      p.slug,
      catId(p.cat),
      brandId(p.brand),
      p.desc,
      JSON.stringify(p.specs),
      p.image_key,
      JSON.stringify(p.gallery),
      p.base_price,
      p.rating,
      p.reviews.length,
      p.popularity,
      p.stock,
      p.featured,
      p.trending
    );
    const prodId = Number(res.lastInsertRowid);

    for (const pr of p.prices) {
      insertPrice.run(
        prodId,
        pr.store,
        pr.price,
        pr.prev,
        pr.disc,
        pr.ship,
        pr.avail,
        `https://demo.shopgenius.ai/offers/${p.slug}?store=${pr.store}`
      );
    }

    for (const rv of p.reviews) {
      insertReview.run(prodId, rv.author, rv.rating, rv.title, rv.comment);
    }
  }

  // Seed Notifications for demo user
  db.prepare(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)"
  ).run(1, "price_drop", "Verified Price Drop: AeroBook Lite 14", "ShopGenius Direct (Demo) lowered AeroBook Lite 14 to $729 (9% off previous $799).");

  db.prepare(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)"
  ).run(1, "ai_insight", "New Comparison Ready", "Your saved preferences match 3 laptops under $800 and 2 ANC headphones.");

  // Seed Wishlist items for demo user
  db.prepare("INSERT INTO wishlists (user_id, product_id, collection_name, target_price) VALUES (?, ?, ?, ?)").run(1, 1, "Work & Coding", 700);
  db.prepare("INSERT INTO wishlists (user_id, product_id, collection_name, target_price) VALUES (?, ?, ?, ?)").run(1, 6, "Commute Audio", 125);

  // Seed Announcement
  db.prepare("INSERT INTO announcements (title, body, active) VALUES (?, ?, 1)").run(
    "Demonstration Catalog Mode",
    "All product listings, store prices, and checkout reservations use realistic demonstration catalog data for evaluation."
  );
}
