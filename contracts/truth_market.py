# { "Depends": "py-genlayer:test" }

"""
TruthMarket — Decentralized Prediction Market on GenLayer
==========================================================
Users create markets on any real-world yes/no question.
Anyone can bet YES or NO with ETH.
After the deadline, GenLayer validators autonomously resolve
the outcome by fetching live web data + running an LLM jury
via Optimistic Democracy — no admin, no Chainlink, no trusted oracle.

Unique GenLayer features used:
  - gl.get_webpage()       → fetch live web evidence on-chain
  - gl.exec_prompt()       → LLM reasoning on every validator
  - eq_principle_strict_eq → consensus over structured JSON output
  - gl.message_sender      → identify bettor wallets
  - gl.message_value       → accept ETH bets natively
"""

from genlayer import *
import json
import typing


# ─── Constants ────────────────────────────────────────────────────────────────

PLATFORM_FEE_BPS = 200   # 2% platform fee (basis points)
MIN_BET_WEI      = 10_000_000_000_000_000  # 0.01 ETH minimum bet


# ─── Market status enum ───────────────────────────────────────────────────────

class Status:
    OPEN     = "open"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


# ─── Contract ─────────────────────────────────────────────────────────────────

class TruthMarket(gl.Contract):
    """
    Prediction market where any real-world yes/no question can be traded.
    Resolution is fully autonomous: no admin can interfere with outcomes.
    """

    # ── On-chain state ────────────────────────────────────────────────────────
    markets:       TreeMap[int, dict]      # market_id → market data
    bets:          TreeMap[str, int]       # "market_id:address:side" → amount (wei)
    market_count:  int
    owner:         str                     # deployer address (for fee withdrawal)
    fee_balance:   int                     # accumulated platform fees (wei)


    def __init__(self):
        self.markets      = TreeMap()
        self.bets         = TreeMap()
        self.market_count = 0
        self.owner        = gl.message_sender
        self.fee_balance  = 0


    # ── Write: create market ──────────────────────────────────────────────────

    @gl.public.write
    def create_market(
        self,
        question:   str,
        source_url: str,
        criteria:   str,
        deadline:   int,
    ) -> int:
        """
        Create a new prediction market.

        Parameters
        ----------
        question   : Clear yes/no question. e.g. "Will ETH exceed $5000 by end of April 2026?"
        source_url : Public URL with verifiable evidence after the event.
        criteria   : What constitutes a YES resolution.
        deadline   : Unix timestamp — no bets accepted after this point.

        Returns
        -------
        market_id : int
        """
        if not question.strip():
            raise Exception("Question cannot be empty.")
        if not source_url.startswith("http"):
            raise Exception("source_url must be a valid HTTP(S) URL.")
        if deadline <= 0:
            raise Exception("Invalid deadline timestamp.")

        mid = self.market_count
        self.markets[mid] = {
            "id":          mid,
            "creator":     gl.message_sender,
            "question":    question,
            "source_url":  source_url,
            "criteria":    criteria,
            "deadline":    deadline,
            "status":      Status.OPEN,
            "outcome":     None,    # True=YES, False=NO
            "reasoning":   "",
            "pool_yes":    0,       # total wei bet YES
            "pool_no":     0,       # total wei bet NO
            "total_pool":  0,
        }
        self.market_count += 1
        return mid


    # ── Write: place bet ─────────────────────────────────────────────────────

    @gl.public.write
    def bet(self, market_id: int, side: bool) -> None:
        """
        Place a bet on a market.

        Parameters
        ----------
        market_id : Target market ID.
        side      : True = YES, False = NO.

        Send ETH with the transaction (gl.message_value).
        Minimum bet: 0.01 ETH.
        """
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]

        if market["status"] != Status.OPEN:
            raise Exception("Market is not open for betting.")

        amount = gl.message_value
        if amount < MIN_BET_WEI:
            raise Exception(f"Minimum bet is 0.01 ETH. Sent: {amount} wei.")

        bettor  = gl.message_sender
        side_str = "yes" if side else "no"
        key     = f"{market_id}:{bettor}:{side_str}"

        # Accumulate bets (same bettor can add more)
        current = self.bets.get(key, 0)
        self.bets[key] = current + amount

        # Update market pools
        if side:
            market["pool_yes"]   += amount
        else:
            market["pool_no"]    += amount
        market["total_pool"] += amount
        self.markets[market_id] = market


    # ── Write: resolve market ─────────────────────────────────────────────────

    @gl.public.write
    def resolve(self, market_id: int) -> None:
        """
        Resolve a market by fetching live web data and running an LLM jury.

        This is the core GenLayer magic:
          1. Each validator independently fetches source_url
          2. Each validator independently runs the LLM prompt
          3. Optimistic Democracy + Equivalence Principle produce consensus
          4. Result is committed on-chain — no admin can override

        Can be called by anyone after the market deadline.
        """
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]

        if market["status"] != Status.OPEN:
            raise Exception(f"Market already {market['status']}.")

        question   = market["question"]
        source_url = market["source_url"]
        criteria   = market["criteria"]

        # ── Non-deterministic block (MUST be isolated) ────────────────────
        # GenLayer runs this on every validator and applies the
        # Equivalence Principle to reach a single canonical result.
        def fetch_and_decide() -> str:
            # Step 1: Fetch live evidence from the web
            page_text = gl.get_webpage(source_url, mode="text")
            evidence  = page_text[:6000]  # keep prompt size manageable

            # Step 2: LLM jury evaluates the evidence
            prompt = f"""You are a neutral, precise fact-checker for a decentralized prediction market.

QUESTION (requires YES or NO):
{question}

RESOLUTION CRITERIA (what counts as YES):
{criteria}

EVIDENCE (fetched live from {source_url}):
{evidence}

INSTRUCTIONS:
- Base your verdict ONLY on the evidence above.
- Do NOT use prior knowledge or assumptions.
- If the evidence is ambiguous or inconclusive, answer NO.
- Be deterministic and precise.

Respond ONLY with valid JSON (no markdown, no extra text):
{{
  "outcome": "YES" or "NO",
  "confidence": "high" | "medium" | "low",
  "reasoning": "One concise sentence explaining your decision based on the evidence."
}}"""

            raw = gl.exec_prompt(prompt)
            return raw.strip().replace("```json", "").replace("```", "").strip()

        # ── Equivalence Principle: strict JSON match across validators ────
        raw_result: str = gl.eq_principle_strict_eq(fetch_and_decide)

        # ── Parse and commit ──────────────────────────────────────────────
        try:
            parsed    = json.loads(raw_result)
            outcome   = parsed.get("outcome", "NO").upper() == "YES"
            reasoning = parsed.get("reasoning", "")
        except (json.JSONDecodeError, AttributeError):
            outcome   = False
            reasoning = f"Parse error: {raw_result[:200]}"

        market["status"]    = Status.RESOLVED
        market["outcome"]   = outcome
        market["reasoning"] = reasoning
        self.markets[market_id] = market


    # ── Write: claim winnings ────────────────────────────────────────────────

    @gl.public.write
    def claim(self, market_id: int) -> int:
        """
        Claim winnings after a market resolves.

        Payout formula (parimutuel):
          winner_share = (your_bet / winning_pool) × (total_pool × (1 - fee))

        Returns the amount sent back (wei).
        """
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]

        if market["status"] != Status.RESOLVED:
            raise Exception("Market not yet resolved.")

        bettor    = gl.message_sender
        outcome   = market["outcome"]
        side_str  = "yes" if outcome else "no"
        key       = f"{market_id}:{bettor}:{side_str}"

        bet_amount = self.bets.get(key, 0)
        if bet_amount == 0:
            raise Exception("No winning bet found for this address.")

        winning_pool = market["pool_yes"] if outcome else market["pool_no"]
        total_pool   = market["total_pool"]

        # Calculate payout with platform fee
        gross_payout  = (bet_amount * total_pool) // winning_pool
        fee_amount    = (gross_payout * PLATFORM_FEE_BPS) // 10_000
        net_payout    = gross_payout - fee_amount

        # Zero out bet to prevent double-claim
        self.bets[key]    = 0
        self.fee_balance += fee_amount

        # Transfer winnings
        gl.transfer(bettor, net_payout)
        return net_payout


    # ── Write: cancel market (edge case) ─────────────────────────────────────

    @gl.public.write
    def cancel_market(self, market_id: int) -> None:
        """
        Cancel a market with no bets. Only the creator can cancel.
        Once bets exist, the market cannot be cancelled.
        """
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]

        if gl.message_sender != market["creator"]:
            raise Exception("Only the market creator can cancel.")
        if market["total_pool"] > 0:
            raise Exception("Cannot cancel a market with existing bets.")

        market["status"] = Status.CANCELLED
        self.markets[market_id] = market


    # ── View methods ──────────────────────────────────────────────────────────

    @gl.public.view
    def get_market(self, market_id: int) -> dict:
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")
        return dict(self.markets[market_id])

    @gl.public.view
    def get_all_markets(self) -> typing.List[dict]:
        return [dict(self.markets[i]) for i in range(self.market_count)]

    @gl.public.view
    def get_open_markets(self) -> typing.List[dict]:
        return [
            dict(self.markets[i])
            for i in range(self.market_count)
            if self.markets[i]["status"] == Status.OPEN
        ]

    @gl.public.view
    def get_bet(self, market_id: int, bettor: str, side: bool) -> int:
        side_str = "yes" if side else "no"
        key = f"{market_id}:{bettor}:{side_str}"
        return self.bets.get(key, 0)

    @gl.public.view
    def get_potential_payout(self, market_id: int, bettor: str, side: bool) -> int:
        """Estimate payout if the given side wins (before fee)."""
        market     = self.get_market(market_id)
        side_str   = "yes" if side else "no"
        key        = f"{market_id}:{bettor}:{side_str}"
        bet_amount = self.bets.get(key, 0)
        if bet_amount == 0:
            return 0
        winning_pool = market["pool_yes"] if side else market["pool_no"]
        if winning_pool == 0:
            return 0
        gross = (bet_amount * market["total_pool"]) // winning_pool
        return gross - (gross * PLATFORM_FEE_BPS) // 10_000

    @gl.public.view
    def total_markets(self) -> int:
        return self.market_count
