# 🎮 Gamification Engine

Shopify Embedded App for gamified discount campaigns - Spin Wheel, Scratch Card, Popup.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Shopify Partner Account

### Installation

```bash
# Clone
git clone https://github.com/Growth-Sheriff/gamification-engine.dev.git
cd gamification-engine

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
pnpm db:push
pnpm db:generate

# Run development
pnpm dev
```

### Production Deployment

```bash
# Build
pnpm build

# Start with PM2
pm2 start ecosystem.config.cjs --env production
```

## 📁 Project Structure

```
gamification-engine/
├── prisma/             # Database schema
├── src/
│   ├── index.ts        # Entry point
│   ├── config.ts       # Environment config
│   ├── lib/            # Prisma & Shopify clients
│   ├── middleware/     # Auth, tenant, verify
│   ├── routes/         # Express routes
│   └── utils/          # Helper functions
├── views/              # EJS templates
├── public/             # Static assets
└── extensions/         # Theme App Extension
```

## 🔧 Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SHOPIFY_API_KEY` | Shopify app client ID |
| `SHOPIFY_API_SECRET` | Shopify app client secret |
| `SHOPIFY_SCOPES` | Required API scopes |
| `SHOPIFY_API_VERSION` | API version (2025-10) |
| `APP_URL` | Public app URL |
| `SESSION_SECRET` | Session encryption key |

### Shopify Partner Dashboard

- **App URL:** `https://gamification-engine.dev`
- **Redirect URL:** `https://gamification-engine.dev/auth/callback`
- **App Proxy:** `https://gamification-engine.dev/api/proxy`

## 🎯 Features

- **Spin Wheel** - Customizable prize wheel
- **Scratch Card** - Scratch to reveal prizes
- **Popup** - Exit intent and timed popups
- **Discount Rules** - Advanced targeting and limits
- **Analytics** - Conversion tracking
- **Multi-tenant** - Shop domain isolation

## 📊 API Endpoints

### Admin API
- `GET /api/games` - List games
- `POST /api/games` - Create game
- `PUT /api/games/:id` - Update game
- `GET /api/rules` - List discount rules
- `POST /api/rules` - Create rule
- `GET /api/analytics` - Get analytics

### Storefront Proxy
- `POST /api/proxy/init` - Initialize session
- `GET /api/proxy/game` - Get active game
- `POST /api/proxy/play` - Play game
- `POST /api/proxy/track` - Track events

## 🔐 Shopify API

Uses **Shopify GraphQL API 2025-10** exclusively.

## 📝 License

MIT

## 🤝 Support

- Email: support@gamification-engine.dev
- Docs: https://gamification-engine.dev/docs

