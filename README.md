# 🔮 TruthMarket

> **Decentralized prediction market where AI resolves outcomes — no Chainlink, no admin, no trust required.**
> 
> Built on [GenLayer](https://genlayer.com) · Bradbury Hackathon Submission

[![GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-22c55e?style=flat-square)](https://genlayer.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Bradbury%20Testnet-6C5CE7?style=flat-square)](https://studio.genlayer.com)

---

## The Problem

Traditional prediction markets have a fatal flaw: **who resolves the outcome?**

- Centralized platforms (Polymarket) → admin can manipulate
- Oracle services (Chainlink) → trusted third party, extra fees, off-chain data
- DAO voting → slow, gameable, expensive

**Every existing solution reintroduces trust.**

## The Solution

TruthMarket replaces oracles entirely. GenLayer validators **fetch live web data and run an LLM jury** to reach consensus — all on-chain, all autonomous, all verifiable.

```
User creates market → People bet YES/NO with ETH
       ↓
Deadline passes → Anyone triggers resolution
       ↓
Each GenLayer validator independently:
  1. Fetches the source URL (live web data)
  2. Runs LLM with evidence + question
  3. Returns structured JSON verdict
       ↓
Optimistic Democracy + Equivalence Principle
→ Single canonical truth committed on-chain
       ↓
Winners claim proportional payout automatically
```

No admin. No oracle fee. No manipulation. Just math and consensus.

---

## How GenLayer Makes This Possible

### `gl.get_webpage()` — On-chain web browsing
Every validator fetches the source URL independently at resolution time. The evidence is live, not stale.

### `gl.exec_prompt()` — On-chain LLM reasoning
Each validator runs the same LLM prompt over the fetched evidence. The AI interprets natural-language outcomes — something impossible in traditional EVM contracts.

### `eq_principle_strict_eq()` — Equivalence Principle
Since LLMs are non-deterministic, validators may get slightly different text. GenLayer's Equivalence Principle defines "agreement" semantically. For structured JSON output (our case), strict equality ensures reliable consensus.

### Optimistic Democracy
Results are proposed by a leader validator and verified by the jury. Economic penalties discourage dishonest proposals. The result is as trustless as the blockchain itself.

---

## Contract Architecture

```
TruthMarket (truth_market.py)
├── create_market()     Write — create a new prediction market
├── bet()               Write — place ETH bet (YES or NO)
├── resolve()           Write — trigger AI resolution (callable by anyone)
├── claim()             Write — claim winnings after resolution
├── cancel_market()     Write — cancel empty market (creator only)
├── get_market()        View  — fetch single market data
├── get_all_markets()   View  — fetch all markets
├── get_open_markets()  View  — fetch only live markets
├── get_bet()           View  — check a specific bet
└── get_potential_payout() View — estimate payout before resolution
```

**Payout formula (parimutuel):**
```
payout = (your_bet / winning_pool) × total_pool × (1 - 0.02 fee)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Python Intelligent Contract (GenLayer) |
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Web3 SDK | genlayer-js |
| Network | GenLayer Bradbury Testnet |

---

## Quick Start

### Prerequisites
- Node.js 18+
- GenLayer CLI: `npm install -g genlayer`
- GenLayer Studio account at [studio.genlayer.com](https://studio.genlayer.com)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/truthmarket
cd truthmarket
```

### 2. Deploy the contract

**Via GenLayer Studio (easiest):**
1. Open [studio.genlayer.com](https://studio.genlayer.com)
2. Create a new contract → paste contents of `contracts/truth_market.py`
3. Deploy → copy the contract address

**Via GenLayer CLI:**
```bash
npm install
genlayer network       # select studionet or testnet
genlayer deploy        # runs deploy/deployScript.ts
```

### 3. Configure the frontend
```bash
cd frontend
cp .env.example .env
# Edit .env — paste your contract address
```

### 4. Run the frontend
```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Usage Example

### Create a market
```
Question:    "Will Bitcoin exceed $100,000 USD by April 30, 2026?"
Source URL:  "https://coinmarketcap.com/currencies/bitcoin/"
Criteria:    "The price listed for Bitcoin (BTC) exceeds $100,000 USD."
Deadline:    2026-04-30T00:00
```

### Bet
Click **YES** or **NO**, enter ETH amount (min 0.01 ETH), confirm transaction.

### Resolve
After the deadline, click **"Trigger AI Resolution"**. GenLayer validators will:
1. Fetch CoinMarketCap live
2. Ask the LLM: does the evidence satisfy the criteria?
3. Reach consensus via Optimistic Democracy
4. Commit YES or NO on-chain

### Claim
Winners click **"Claim Winnings"** to receive their proportional share of the pool.

---

## Why This Wins

| Feature | TruthMarket | Polymarket | Chainlink Markets |
|---|---|---|---|
| Trustless resolution | ✅ AI + consensus | ❌ Admin | ⚠️ Oracle trust |
| Natural language questions | ✅ Any yes/no | ❌ Structured only | ❌ Price feeds only |
| Oracle fees | ✅ Zero | N/A | ❌ LINK fees |
| Manipulation resistance | ✅ Cryptographic | ❌ Custodial | ⚠️ Partial |
| Dev Fee (passive income) | ✅ 2% forever | ❌ Platform takes all | N/A |

---

## Live Demo

- **Contract:** deployed on GenLayer Bradbury Testnet
- **Frontend:** [coming soon — Vercel deployment]

---

## Resources

- [GenLayer Docs](https://docs.genlayer.com)
- [GenLayer Studio](https://studio.genlayer.com)
- [genlayer-js SDK](https://github.com/yeagerai/genlayer-js)
- [GenLayer Discord](https://discord.gg/8Jm4v89VAu)

---

## License

MIT
