# ⛓️ Bitcoin Blocks

A real-time Bitcoin transaction prediction game built with Next.js, SpacetimeDB, and Farcaster authentication.

## 🎮 How It Works

Users predict the number of transactions in the next Bitcoin block. The winner is whoever gets closest to the actual count!

### Game Flow:
1. **Admin creates a round** with start/end times and prize
2. **Users sign in** with Farcaster and submit predictions (0-1M transactions)
3. **Round closes** automatically at end time
4. **Admin fetches results** from mempool.space API
5. **Winner announced** - closest guess wins (earliest submission breaks ties)

## 🚀 Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Real-time Database**: SpacetimeDB (WebSocket subscriptions)
- **Authentication**: Farcaster Auth Kit
- **Blockchain Data**: mempool.space API
- **UI**: Tailwind CSS + shadcn/ui + Framer Motion

## 📦 Setup

### Quick Start (Development Mode)

The app is currently configured with a **mock SpacetimeDB client** for instant development without requiring a SpacetimeDB server!

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

That's it! The app works out of the box with local state management.

### Production SpacetimeDB Integration

For real-time multi-user synchronization with persistent data, see **[SPACETIME_SETUP.md](./SPACETIME_SETUP.md)** for full SpacetimeDB installation and configuration instructions.

**Quick summary:**
1. Install SpacetimeDB CLI
2. Start local server with `spacetime start`
3. Publish module: `spacetime publish bitcoin-blocks`
4. Generate TypeScript bindings
5. Replace mock client with real SpacetimeDB connection

### Environment Variables

Copy `.env.example` to `.env.local` and update if needed:

```bash
cp .env.example .env.local
```

Default values work for local development.

## 🔑 Admin Access

Only FID **250704** has access to the admin panel to:
- Create new rounds
- End rounds manually
- Fetch results from mempool.space

## 🎯 Features

✅ **Real-time Updates** - All data syncs across clients via SpacetimeDB  
✅ **Farcaster Auth** - Seamless sign-in with latest Auth Kit  
✅ **Live Countdown** - Animated timer with millisecond precision  
✅ **Dynamic Leaderboard** - Updates instantly when new guesses arrive  
✅ **Anti-cheat** - One guess per user per round  
✅ **Transparent Results** - Fetches actual Bitcoin block data  
✅ **Full Audit Trail** - All events logged in SpacetimeDB  

## 📡 SpacetimeDB Schema

### Tables:
- **rounds** - Game rounds with start/end times, prizes, and results
- **guesses** - User predictions with timestamps
- **logs** - Complete event history

### Reducers:
- `create_round` - Start a new prediction round
- `submit_guess` - Submit a transaction count prediction
- `end_round_manually` - Close round before end time
- `update_round_result` - Record actual tx count and winner

## 🔌 API Integration

Uses mempool.space API via proxy endpoint:

1. `GET /api/v1/mining/blocks/timestamp/{time}` - Fetch block at timestamp
2. `GET /api/block/{hash}/txids` - Get transaction IDs in block

## 📱 Farcaster Integration

Built as a Farcaster mini-app with:
- Frame metadata for proper embedding
- SDK initialization for mini-app features
- Manifest signing for authentication

## 🛠️ Development Commands

```bash
# Start SpacetimeDB
spacetime start

# Publish database module
cd spacetime-server && spacetime publish bitcoin-blocks --clear-database

# Run dev server
pnpm dev

# Build for production
pnpm build
```

## 📝 License

MIT

---

Built with ❤️ using [Ohara Mini Apps](https://www.oharaminiapps.xyz/)
