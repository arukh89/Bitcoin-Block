# 🚀 Bitcoin Blocks - Deployment Guide

## SpacetimeDB Real-Time Database Setup

This application uses **SpacetimeDB** for real-time multiplayer functionality. To run the app in production, you need to publish the SpacetimeDB module first.

---

## ⚠️ IMPORTANT: Current Status

**Database Status**: ❌ **OFFLINE**  
**Reason**: SpacetimeDB module not published

The application is trying to connect to:
- **Host**: `wss://<your-mainnet-host>`
- **Module Name**: `bitcoin-block`

But this module **does not exist yet** on the testnet!

---

## 📋 Quick Fix: Publish SpacetimeDB Module

### Option 1: Publish to SpacetimeDB (Mainnet)

#### Step 1: Install SpacetimeDB CLI

```bash
# On macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://install.spacetimedb.com | sh

# On Windows (using PowerShell)
iwr https://windows.spacetimedb.com -useb | iex
```

#### Step 2: Login to SpacetimeDB

```bash
# Create account or login
spacetime login
```

#### Step 3: Publish the Module

```bash
# Navigate to project root
cd /path/to/your/project

# Publish to mainnet
cd spacetime-server
spacetime publish bitcoin-block --clear-database

# Note the module identity returned (hex format like: 0x123abc...)
```

#### Step 4: Update Environment Variables (Optional)

If you want to use a custom module name or hosted instance:

Create `.env.local` in project root:
```env
NEXT_PUBLIC_SPACETIME_HOST=wss://<your-mainnet-host>
NEXT_PUBLIC_SPACETIME_DB_NAME=bitcoin-block
```

#### Step 5: Verify Connection

1. Redeploy your app (push to Vercel or your hosting platform)
2. Open browser console (F12)
3. Look for: `✅ Connected to SpacetimeDB`
4. App status should show: **🟢 Connected**

---

### Option 2: Run Local SpacetimeDB Server

For development or self-hosting:

#### Step 1: Start Local Server

```bash
# Start SpacetimeDB server locally
spacetime start
```

#### Step 2: Publish Module Locally

```bash
cd spacetime-server
spacetime publish bitcoin-block --clear-database
```

#### Step 3: Update Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SPACETIME_HOST=ws://localhost:3000
NEXT_PUBLIC_SPACETIME_DB_NAME=bitcoin-block
```

#### Step 4: Run Your App

```bash
pnpm dev
```

---

## 🔍 Troubleshooting

### Problem: "Database Offline" Message

**Symptoms:**
- Red "Disconnected" badge in header
- Admin panel shows "(Database Offline)"
- Console shows connection timeout errors

**Solution:**
1. Verify module is published: `spacetime list`
2. Check module name matches: `bitcoin-block`
3. Ensure testnet is accessible from your network
4. Check browser console for detailed error messages

### Problem: "Module Not Found" Error

**Symptoms:**
- Console shows: `⚠️ MODULE NOT FOUND`
- WebSocket connection fails with 404

**Solution:**
1. Publish module first (see above)
2. Verify module name is correct
3. Check if you're logged into SpacetimeDB CLI

### Problem: Connection Timeout

**Symptoms:**
- Connection takes >10 seconds
- Console shows: `⚠️ CONNECTION TIMEOUT`

**Solution:**
1. Check internet connection
2. Verify SpacetimeDB testnet is online
3. Try publishing module again
4. Use local instance for testing

---

## 🎮 How SpacetimeDB Works

### Architecture

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   Next.js App   │◄─────────────────────────►│   SpacetimeDB    │
│   (Frontend)    │    Real-time Updates       │   (Backend)      │
└─────────────────┘                            └──────────────────┘
        │                                              │
        │                                              │
   User Actions                                  Server Logic
   (Create Round,                               (Rust Reducers,
    Submit Guess,                                Database Tables)
    Send Chat)
```

### Key Concepts

1. **Tables**: Database tables defined in Rust (Round, Guess, ChatMessage, Log)
2. **Reducers**: Server-side functions that modify data (like API endpoints)
3. **Subscriptions**: Real-time updates pushed to all connected clients
4. **Identity**: Each user gets a unique identity for tracking

### Real-Time Features

- ✅ Live chat messages appear instantly for all users
- ✅ Predictions broadcast to all players in real-time
- ✅ Round status updates sync across all clients
- ✅ Winner announcements pushed to everyone
- ✅ Recent blocks update automatically

---

## 📊 SpacetimeDB Module Info

### Tables Defined

| Table Name      | Purpose                           | Primary Key |
|-----------------|-----------------------------------|-------------|
| `rounds`        | Game rounds data                  | `round_id`  |
| `guesses`       | Player predictions                | `guess_id`  |
| `chat_messages` | Live chat and system messages     | `chat_id`   |
| `logs`          | Admin activity and event logging  | `log_id`    |

### Reducers (Server Functions)

| Reducer Name          | Purpose                        | Access      |
|-----------------------|--------------------------------|-------------|
| `create_round`        | Create new prediction round    | Admin only  |
| `submit_guess`        | Submit player prediction       | All users   |
| `end_round_manually`  | Close round early              | Admin only  |
| `update_round_result` | Set winner and actual result   | Admin only  |
| `send_chat_message`   | Send chat message              | All users   |
| `get_active_round`    | Query current active round     | All users   |

---

## 🔐 Admin Addresses

Only these wallet addresses have admin access:
- `0x09D02D25D0D082f7F2E04b4838cEfe271b2daB09`
- `0xc38B1633E152fC75da3Ff737717c0DA5EF291408`

Admins can:
- Create new rounds
- End rounds manually
- Fetch results from Bitcoin blockchain
- Post announcements to Farcaster

---

## 📚 Additional Resources

- **SpacetimeDB Docs**: https://spacetimedb.com/docs
- **SpacetimeDB CLI Reference**: https://spacetimedb.com/docs/cli
- **TypeScript SDK**: https://spacetimedb.com/docs/sdks/typescript
- **Rust Module Development**: https://spacetimedb.com/docs/modules/rust

---

## 🆘 Need Help?

1. **Check browser console** for detailed error messages
2. **Verify module is published**: Run `spacetime list` in terminal
3. **Test local connection**: Use local SpacetimeDB instance first
4. **Review logs**: SpacetimeDB server logs provide valuable debugging info

---

## ✅ Success Checklist

After following this guide, you should see:

- [ ] SpacetimeDB CLI installed and working
- [ ] Module published to testnet (or running locally)
- [ ] App shows "🟢 Connected" status
- [ ] Admin panel buttons are enabled (not grayed out)
- [ ] Chat messages send and appear instantly
- [ ] Creating a round works without errors
- [ ] Console shows: `✅ Connected to SpacetimeDB`

---

**Last Updated**: 2024  
**Module Version**: 1.0.0  
**SpacetimeDB SDK**: 1.4.0
