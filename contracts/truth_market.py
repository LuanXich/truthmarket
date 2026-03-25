# { "Depends": "py-genlayer:test" }

"""
TruthMarket — Decentralized Prediction Market on GenLayer
==========================================================
Users create markets on any real-world yes/no question.
Resolution is fully autonomous using GenLayer's Optimistic Democracy + Equivalence Principle.
No admin, no Chainlink, no trusted oracle.
"""

from genlayer import *
import json


# ─── Constants ────────────────────────────────────────────────────────────────
PLATFORM_FEE_BPS = 200   # 2% platform fee
MIN_BET_WEI      = 10_000_000_000_000_000  # 0.01 ETH


class Status:
    OPEN      = "open"
    RESOLVED  = "resolved"
    CANCELLED = "cancelled"


class TruthMarket(gl.Contract):
    """Prediction market with autonomous AI resolution powered by GenLayer."""

    markets:      TreeMap[int, dict]
    bets:         TreeMap[str, int]       # key: "market_id:bettor:yes/no"
    market_count: int
    owner:        str
    fee_balance:  int

    def __init__(self):
        self.markets      = TreeMap()
        self.bets         = TreeMap()
        self.market_count = 0
        self.owner        = gl.message_sender
        self.fee_balance  = 0

    # ── Create Market ───────────────────────────────────────────────────────
    @gl.public.write
    def create_market(
        self,
        question:   str,
        source_url: str,
        criteria:   str,
        deadline:   int,
    ) -> int:
        if not question or not question.strip():
            raise Exception("Question cannot be empty.")
        if not source_url.startswith(("http://", "https://")):
            raise Exception("source_url must be a valid HTTP(S) URL.")
        if deadline <= gl.block_timestamp():
            raise Exception("Deadline must be in the future.")

        mid = self.market_count
        self.markets[mid] = {
            "id":          mid,
            "creator":     gl.message_sender,
            "question":    question.strip(),
            "source_url":  source_url,
            "criteria":    criteria.strip(),
            "deadline":    deadline,
            "status":      Status.OPEN,
            "outcome":     None,      # True = YES, False = NO
            "reasoning":   "",
            "pool_yes":    0,
            "pool_no":     0,
            "total_pool":  0,
        }
        self.market_count += 1
        return mid

    # ── Place Bet ───────────────────────────────────────────────────────────
    @gl.public.write
    def bet(self, market_id: int, side: bool) -> None:
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]
        if market["status"] != Status.OPEN:
            raise Exception("Market is not open.")
        if gl.block_timestamp() > market["deadline"]:
            raise Exception("Market deadline has passed.")

        amount = gl.message_value
        if amount < MIN_BET_WEI:
            raise Exception(f"Minimum bet is 0.01 ETH.")

        bettor = gl.message_sender
        side_str = "yes" if side else "no"
        key = f"{market_id}:{bettor}:{side_str}"

        current = self.bets.get(key, 0)
        self.bets[key] = current + amount

        if side:
            market["pool_yes"] += amount
        else:
            market["pool_no"] += amount
        market["total_pool"] += amount

        self.markets[market_id] = market

    # ── Resolve Market (Core GenLayer Feature) ───────────────────────────────
    @gl.public.write
    def resolve(self, market_id: int) -> None:
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]
        if market["status"] != Status.OPEN:
            raise Exception("Market already resolved or cancelled.")
        if gl.block_timestamp() < market["deadline"]:
            raise Exception("Cannot resolve before deadline.")

        question   = market["question"]
        source_url = market["source_url"]
        criteria   = market["criteria"]

        # Non-deterministic function - this runs on every validator
        def fetch_and_decide() -> str:
            # Fetch live evidence
            page_text = gl.get_webpage(source_url, mode="text")
            evidence  = page_text[:5000]   # Limit size for prompt

            prompt = f"""You are an impartial fact-checker for a decentralized prediction market.

QUESTION: {question}

RESOLUTION CRITERIA (what counts as YES): {criteria}

LIVE EVIDENCE from {source_url}:
{evidence}

Rules:
- Answer ONLY based on the evidence above.
- If evidence is insufficient or ambiguous → answer "NO".
- Be extremely precise and objective.

Return ONLY this exact JSON format, nothing else:
{{
  "outcome": "YES" or "NO",
  "confidence": "high" or "medium" or "low",
  "reasoning": "One short sentence based strictly on the evidence."
}}"""

            result = gl.exec_prompt(prompt)
            # Clean output
            cleaned = result.strip().replace("```json", "").replace("```", "").strip()
            return cleaned

        # === CORE HACKATHON REQUIREMENT ===
        # Optimistic Democracy + Equivalence Principle
        raw_result: str = gl.eq_principle_strict_eq(fetch_and_decide)

        # Parse result
        try:
            parsed = json.loads(raw_result)
            outcome = parsed.get("outcome", "NO").upper() == "YES"
            reasoning = parsed.get("reasoning", "No reasoning provided.")
        except Exception:
            outcome = False
            reasoning = "Failed to parse LLM output. Defaulting to NO."

        # Commit result
        market["status"]    = Status.RESOLVED
        market["outcome"]   = outcome
        market["reasoning"] = reasoning
        self.markets[market_id] = market

    # ── Claim Winnings ──────────────────────────────────────────────────────
    @gl.public.write
    def claim(self, market_id: int) -> int:
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]
        if market["status"] != Status.RESOLVED:
            raise Exception("Market not yet resolved.")

        bettor = gl.message_sender
        winning_side = "yes" if market["outcome"] else "no"
        key = f"{market_id}:{bettor}:{winning_side}"

        bet_amount = self.bets.get(key, 0)
        if bet_amount == 0:
            raise Exception("You have no winning bet on this market.")

        winning_pool = market["pool_yes"] if market["outcome"] else market["pool_no"]
        total_pool   = market["total_pool"]

        gross_payout = (bet_amount * total_pool) // winning_pool if winning_pool > 0 else 0
        fee_amount   = (gross_payout * PLATFORM_FEE_BPS) // 10_000
        net_payout   = gross_payout - fee_amount

        # Prevent double claim
        self.bets[key] = 0
        self.fee_balance += fee_amount

        gl.transfer(bettor, net_payout)
        return net_payout

    # ── Cancel Market (only if no bets) ─────────────────────────────────────
    @gl.public.write
    def cancel_market(self, market_id: int) -> None:
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")

        market = self.markets[market_id]
        if gl.message_sender != market["creator"]:
            raise Exception("Only creator can cancel.")
        if market["total_pool"] > 0:
            raise Exception("Cannot cancel market with existing bets.")

        market["status"] = Status.CANCELLED
        self.markets[market_id] = market

    # ── View Functions ──────────────────────────────────────────────────────
    @gl.public.view
    def get_market(self, market_id: int) -> dict:
        if market_id not in self.markets:
            raise Exception(f"Market {market_id} does not exist.")
        return dict(self.markets[market_id])

    @gl.public.view
    def get_all_markets(self) -> list:
        return [dict(self.markets[i]) for i in range(self.market_count)]

    @gl.public.view
    def get_open_markets(self) -> list:
        return [dict(self.markets[i]) for i in range(self.market_count) if self.markets[i]["status"] == Status.OPEN]

    @gl.public.view
    def total_markets(self) -> int:
        return self.market_count
