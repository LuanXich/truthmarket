"use client"; 
import { useState, useEffect, useCallback } from "react";
import {
  getAllMarkets,
  createMarket,
  placeBet,
  resolveMarket,
  claimWinnings,
  formatEth,
  getYesPercent,
  timeUntilDeadline,
  type Market,
} from "@/lib/genlayer";
import {
  TrendingUp,
  Plus,
  Globe,
  Zap,
  Trophy,
  Clock,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

function StatusBadge({ status, outcome }: { status: string; outcome: boolean | null }) {
  if (status === "resolved") {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
        outcome ? "bg-green-900/50 text-green-400 border border-green-800" : "bg-red-900/50 text-red-400 border border-red-800"
      }`}>
        {outcome ? "✓ YES" : "✗ NO"}
      </span>
    );
  }
  if (status === "cancelled") {
    return <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-500 border border-gray-700">CANCELLED</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs font-mono bg-brand-500/10 text-brand-400 border border-brand-500/30 animate-pulse-slow">LIVE</span>;
}

function OddsBar({ yesPercent }: { yesPercent: number }) {
  return (
    <div className="relative h-2 rounded-full bg-dark-600 overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full progress-yes rounded-full transition-all duration-500"
        style={{ width: `${yesPercent}%` }}
      />
    </div>
  );
}

function MarketCard({ market, onSelect }: { market: Market; onSelect: (m: Market) => void }) {
  const yp = getYesPercent(market);
  return (
    <button
      onClick={() => onSelect(market)}
      className="market-card w-full text-left bg-dark-800 border border-dark-600 rounded-xl p-5 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-200 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {market.question}
        </p>
        <StatusBadge status={market.status} outcome={market.outcome} />
      </div>
      <OddsBar yesPercent={yp} />
      <div className="flex justify-between mt-1.5 mb-4">
        <span className="text-xs font-mono text-green-400">{yp}% YES</span>
        <span className="text-xs font-mono text-red-400">{100 - yp}% NO</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {formatEth(market.total_pool)} pooled
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeUntilDeadline(market.deadline)}
        </span>
        <ChevronRight className="w-3 h-3 text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

function MarketDetail({ market, onBack, onRefresh }: { market: Market; onBack: () => void; onRefresh: () => void }) {
  const [betSide, setBetSide] = useState<boolean>(true);
  const [betAmount, setBetAmount] = useState("0.05");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const yp = getYesPercent(market);

  const handleBet = async () => {
    setLoading(true); setMsg(null);
    try {
      const wei = BigInt(Math.floor(parseFloat(betAmount) * 1e18));
      await placeBet(market.id, betSide, wei);
      setMsg({ type: "ok", text: "Bet placed! Transaction submitted to GenLayer." });
      onRefresh();
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Transaction failed." });
    } finally { setLoading(false); }
  };

  const handleResolve = async () => {
    setLoading(true); setMsg(null);
    try {
      await resolveMarket(market.id);
      setMsg({ type: "ok", text: "Resolution submitted! Validators fetching web data + running LLM jury..." });
      onRefresh();
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to resolve." });
    } finally { setLoading(false); }
  };

  const handleClaim = async () => {
    setLoading(true); setMsg(null);
    try {
      await claimWinnings(market.id);
      setMsg({ type: "ok", text: "Winnings claimed! Check your wallet." });
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Claim failed." });
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-6 transition-colors">
        ← Back to markets
      </button>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-white leading-snug">{market.question}</h2>
          <StatusBadge status={market.status} outcome={market.outcome} />
        </div>
        <div className="mb-6">
          <OddsBar yesPercent={yp} />
          <div className="flex justify-between mt-2">
            <div>
              <div className="text-2xl font-display font-bold text-green-400">{yp}%</div>
              <div className="text-xs text-gray-500">YES · {formatEth(market.pool_yes)}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-red-400">{100 - yp}%</div>
              <div className="text-xs text-gray-500">NO · {formatEth(market.pool_no)}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Pool", value: formatEth(market.total_pool) },
            { label: "Deadline", value: timeUntilDeadline(market.deadline) },
            { label: "Market #", value: `#${market.id}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-dark-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-sm font-mono font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="space-y-3 mb-6">
          <div className="bg-dark-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Globe className="w-3 h-3" /> Resolution source
            </div>
            <a href={market.source_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand-400 hover:text-brand-500 flex items-center gap-1 truncate">
              {market.source_url}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
          <div className="bg-dark-700 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Resolution criteria (YES if)</div>
            <p className="text-xs text-gray-300">{market.criteria}</p>
          </div>
        </div>
        {market.status === "resolved" && market.reasoning && (
          <div className="bg-dark-700 border border-brand-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-xs text-brand-400 mb-2">
              <Zap className="w-3 h-3" /> AI verdict reasoning
            </div>
            <p className="text-sm text-gray-200">{market.reasoning}</p>
          </div>
        )}
        {msg && (
          <div className={`flex items-start gap-2 rounded-lg p-3 mb-4 text-sm ${
            msg.type === "ok"
              ? "bg-green-900/30 border border-green-800 text-green-300"
              : "bg-red-900/30 border border-red-800 text-red-300"
          }`}>
            {msg.type === "ok" ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
        {market.status === "open" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setBetSide(true)}
                className={`py-3 rounded-lg font-semibold text-sm transition-all ${
                  betSide ? "bg-green-600 text-white glow-green" : "bg-dark-700 text-gray-400 hover:text-white"
                }`}>
                👍 YES
              </button>
              <button onClick={() => setBetSide(false)}
                className={`py-3 rounded-lg font-semibold text-sm transition-all ${
                  !betSide ? "bg-red-600 text-white" : "bg-dark-700 text-gray-400 hover:text-white"
                }`}>
                👎 NO
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type="number" min="0.01" step="0.01" value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-500" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">ETH</span>
              </div>
              <button onClick={handleBet} disabled={loading}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors">
                {loading ? "..." : "Place Bet"}
              </button>
            </div>
            <button onClick={handleResolve} disabled={loading}
              className="w-full py-2.5 bg-dark-600 hover:bg-dark-500 disabled:opacity-50 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-brand-400" />
              Trigger AI Resolution
            </button>
          </div>
        )}
        {market.status === "resolved" && (
          <button onClick={handleClaim} disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4" />
            {loading ? "Processing..." : "Claim Winnings"}
          </button>
        )}
      </div>
    </div>
  );
}

function CreateMarketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ question: "", source_url: "", criteria: "", deadline: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!form.question || !form.source_url || !form.criteria || !form.deadline) {
      setErr("All fields are required."); return;
    }
    setLoading(true); setErr("");
    try {
      const deadlineUnix = Math.floor(new Date(form.deadline).getTime() / 1000);
      await createMarket(form.question, form.source_url, form.criteria, deadlineUnix);
      onCreated();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create market.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md animate-fade-up">
        <h3 className="text-lg font-display font-bold text-white mb-5">Create New Market</h3>
        <div className="space-y-3">
          {[
            { key: "question", label: "Question (yes/no)", placeholder: "Will ETH exceed $5000 by April 30, 2026?", type: "text" },
            { key: "source_url", label: "Source URL", placeholder: "https://coinmarketcap.com/currencies/ethereum/", type: "url" },
            { key: "criteria", label: "Resolution criteria (what counts as YES)", placeholder: "ETH price shown exceeds $5000 USD", type: "text" },
            { key: "deadline", label: "Deadline", placeholder: "", type: "datetime-local" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input type={type} placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
            </div>
          ))}
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 bg-dark-700 text-gray-400 rounded-lg text-sm hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
              {loading ? "Creating..." : "Create Market"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState<Market | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const fetchMarkets = useCallback(async () => {
    try {
      const data = await getAllMarkets();
      setMarkets(data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const filtered = markets.filter((m) => filter === "all" ? true : m.status === filter);

  return (
    <div className="min-h-screen grid-bg">
      <header className="border-b border-dark-600 bg-dark-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center glow-green">
              <TrendingUp className="w-4 h-4 text-dark-900" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-lg">TruthMarket</span>
              <span className="ml-2 text-xs font-mono text-brand-400 opacity-70">on GenLayer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchMarkets} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-dark-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition-colors glow-green">
              <Plus className="w-4 h-4" /> New Market
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!selected ? (
          <>
            <div className="text-center mb-10">
              <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-3 text-glow">
                Bet on Reality.<br />
                <span className="text-brand-400">AI Decides the Truth.</span>
              </h1>
              <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
                Create prediction markets on any real-world event. GenLayer validators
                autonomously fetch web data and run an LLM jury to resolve outcomes —
                no admin, no oracle fees, no manipulation.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-gray-600">
                {["Web-native oracle", "LLM jury consensus", "Permissionless", "Optimistic Democracy"].map((t) => (
                  <span key={t} className="flex items-center gap-1">
                    <span className="text-brand-500">✓</span> {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              {(["all", "open", "resolved"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                    filter === f ? "bg-brand-500 text-white" : "bg-dark-700 text-gray-500 hover:text-white"
                  }`}>
                  {f}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-600 self-center font-mono">
                {filtered.length} market{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-dark-800 border border-dark-600 rounded-xl p-5 animate-pulse">
                    <div className="h-4 bg-dark-600 rounded mb-3 w-3/4" />
                    <div className="h-2 bg-dark-600 rounded mb-4" />
                    <div className="h-3 bg-dark-600 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-display font-semibold text-lg mb-2">No markets yet</p>
                <p className="text-sm">Create the first market and start trading truth.</p>
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition-colors">
                  Create Market
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((m) => (
                  <MarketCard key={m.id} market={m} onSelect={setSelected} />
                ))}
              </div>
            )}
          </>
        ) : (
          <MarketDetail
            market={selected}
            onBack={() => setSelected(null)}
            onRefresh={() => {
              fetchMarkets();
              import("@/lib/genlayer").then(({ getMarket }) =>
                getMarket(selected.id).then(setSelected).catch(() => {})
              );
            }}
          />
        )}
      </main>

      {showCreate && (
        <CreateMarketModal onClose={() => setShowCreate(false)} onCreated={fetchMarkets} />
      )}
    </div>
  );
}
