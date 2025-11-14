# 🚀 SpacetimeDB Production Setup Guide

## Current State

The app is currently running with a **mock SpacetimeDB client** for development purposes. This allows the app to build and run without requiring a local SpacetimeDB instance.

## Production SpacetimeDB Integration

To connect to a real SpacetimeDB instance, follow these steps:

### 1. Install SpacetimeDB CLI

```bash
curl --proto '=https' --tlsv1.2 -sSf https://install.spacetimedb.com | sh
```

### 2. Start Local SpacetimeDB Server

```bash
spacetime start
```

### 3. Publish the Database Module

```bash
cd spacetime-server
spacetime publish bitcoin-blocks --clear-database
```

### 4. Generate TypeScript Bindings

```bash
spacetime generate --lang typescript --out-dir ../src/spacetime_module_bindings bitcoin-blocks
```

This will create strongly-typed client bindings in `src/spacetime_module_bindings/`

### 5. Update Environment Variables

Create/update `.env.local`:

```env
# For local development
NEXT_PUBLIC_SPACETIME_HOST=ws://localhost:3000
NEXT_PUBLIC_SPACETIME_DB_NAME=bitcoin-blocks

# For production (update with your hosted instance)
# NEXT_PUBLIC_SPACETIME_HOST=wss://your-spacetime-instance.com
# NEXT_PUBLIC_SPACETIME_DB_NAME=bitcoin-blocks
```

### 6. Replace Mock Client with Real SpacetimeDB Client

Update `src/lib/spacetime-client.ts` to use the generated bindings:

```typescript
import { DbConnection } from 'spacetimedb'
import { Round, Guess, LogEvent } from '../spacetime_module_bindings'

const client = new DbConnection({
  host: process.env.NEXT_PUBLIC_SPACETIME_HOST,
  dbName: process.env.NEXT_PUBLIC_SPACETIME_DB_NAME
})

// Use the generated reducer functions
import { create_round, submit_guess, end_round_manually, update_round_result } from '../spacetime_module_bindings'
```

## Mock vs Real SpacetimeDB

### Current Mock Implementation
- ✅ Builds without SpacetimeDB server running
- ✅ Local state management with React Context
- ✅ Simulates real-time updates with intervals
- ❌ Data not persisted across page refreshes
- ❌ No multi-user real-time sync

### Real SpacetimeDB
- ✅ True real-time WebSocket subscriptions
- ✅ Persistent data storage
- ✅ Multi-user synchronization across all clients
- ✅ Server-side validation and business logic
- ✅ Automatic schema migrations
- ⚠️ Requires SpacetimeDB server instance

## Testing with Real SpacetimeDB

1. **Start the server**: `spacetime start`
2. **Publish module**: `cd spacetime-server && spacetime publish bitcoin-blocks`
3. **Run the app**: `pnpm dev`
4. **Test in multiple browser tabs** to see real-time sync!

## Hosting SpacetimeDB in Production

SpacetimeDB can be hosted on:
- **Clockwork Labs Cloud** (official hosting)
- **Self-hosted** on VPS/cloud providers
- **Docker containers** for containerized deployments

Refer to [SpacetimeDB Hosting Documentation](https://spacetimedb.com/docs) for detailed instructions.

## Current Status

✅ **Development Mode**: App uses mock client for rapid development  
🔄 **Production Ready**: Schema and reducers defined, ready to connect to real SpacetimeDB  
📦 **Easy Migration**: Simply swap mock client with real SpacetimeDB connection when ready

---

**Note**: The Rust server module in `spacetime-server/src/lib.rs` is fully functional and production-ready. The only step needed is connecting the frontend to a running SpacetimeDB instance!
