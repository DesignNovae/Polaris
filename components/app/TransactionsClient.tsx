"use client";

/**
 * Transactions - the payment ledger.
 *
 *   Overview     - animated counters: payments, spend, succeeded/failed/pending
 *   Filter bar   - status chips, method filter, free-text search
 *   Ledger rows  - layered cards with method badge, status, reference
 *   Detail modal - full record + Polaris-branded receipt with print action
 *
 * Rows are real DB records created by the sandbox checkout - nothing here is
 * hardcoded.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./ui";
import { PaymentLogo, CardBrandMark } from "./PaymentLogos";
import { PremiumSelect, OptionDot } from "@/components/ui/PremiumSelect";
import { cn } from "@/lib/cn";

export type TxDto = {
  id: string;
  reference: string;
  method: "card" | "bkash" | "nagad" | "rocket";
  amount: number;
  currency: string;
  description: string;
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded";
  maskedAccount?: string;
  cardBrand?: string;
  failureReason?: string;
  createdAt: string;
};


const STATUS_META: Record<TxDto["status"], { label: string; cls: string; dot: string }> = {
  succeeded:  { label: "Paid",       cls: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30", dot: "bg-aurora-500" },
  pending:    { label: "Pending",    cls: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/15 dark:text-polaris-100 dark:ring-polaris-400/30", dot: "bg-polaris-500 animate-pulse" },
  processing: { label: "Processing", cls: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/15 dark:text-polaris-100 dark:ring-polaris-400/30", dot: "bg-polaris-500 animate-pulse" },
  failed:     { label: "Failed",     cls: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30", dot: "bg-rose-500" },
  refunded:   { label: "Refunded",   cls: "bg-paper-deep text-ink-muted ring-ink-faint/30 dark:bg-white/[0.06] dark:ring-white/[0.1]", dot: "bg-ink-faint" },
};

function money(minor: number, ccy: string): string {
  const v = minor / 100;
  if (ccy === "BDT") return `৳${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type StatusFilter = "all" | TxDto["status"];

export function TransactionsClient({ rows, userName, userEmail }: { rows: TxDto[]; userName: string; userEmail: string }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<"all" | TxDto["method"]>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const spend = new Map<string, number>();
    let ok = 0, bad = 0, wait = 0;
    for (const t of rows) {
      if (t.status === "succeeded") { ok += 1; spend.set(t.currency, (spend.get(t.currency) ?? 0) + t.amount); }
      else if (t.status === "failed") bad += 1;
      else if (t.status === "pending" || t.status === "processing") wait += 1;
    }
    return { total: rows.length, ok, bad, wait, spend: [...spend.entries()] };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (method !== "all" && t.method !== method) return false;
      if (!q) return true;
      return (
        t.description.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        (t.maskedAccount ?? "").includes(q)
      );
    });
  }, [rows, status, method, query]);

  const open = rows.find((t) => t.id === openId) ?? null;

  return (
    <div className="space-y-5">
      {/* ─── Overview ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Payments" value={String(stats.total)} sub={`${stats.ok} successful`} tone="polaris" delay={0} />
        <StatCard
          label="Total spent"
          value={stats.spend.length ? stats.spend.map(([c, m]) => money(m, c)).join(" + ") : "-"}
          sub="sandbox ledger" tone="aurora" delay={0.06}
        />
        <StatCard label="Failed" value={String(stats.bad)} sub={stats.bad ? "review & retry" : "all clear"} tone="rose" delay={0.12} />
        <StatCard label="Pending" value={String(stats.wait)} sub={stats.wait ? "awaiting confirm" : "none open"} tone="ink" delay={0.18} />
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-paper-card hairline focus-within:ring-1 focus-within:ring-polaris-400 flex-1 min-w-[180px] max-w-xs">
          <span className="text-ink-muted shrink-0"><Icon.search size={14} /></span>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, plan, account…"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted/70 outline-none min-w-0"
          />
        </label>
        {(["all", "succeeded", "pending", "failed", "refunded"] as StatusFilter[]).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={cn(
              "h-9 text-[11.5px] font-medium px-3 rounded-xl ring-1 ring-inset transition-colors capitalize",
              status === s ? "bg-ink text-paper ring-ink" : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:text-ink dark:ring-white/[0.12]",
            )}>
            {s === "all" ? "All" : STATUS_META[s as TxDto["status"]].label}
          </button>
        ))}
        <PremiumSelect
          value={method}
          onChange={(v) => setMethod(v as typeof method)}
          label="Method"
          align="right"
          options={[
            { value: "all", label: "All" },
            { value: "card", label: "Card", icon: <OptionDot className="bg-[#374151]" /> },
            { value: "bkash", label: "bKash", icon: <OptionDot className="bg-[#CF3D6E]" /> },
            { value: "nagad", label: "Nagad", icon: <OptionDot className="bg-[#F15A29]" /> },
            { value: "rocket", label: "Rocket", icon: <OptionDot className="bg-[#9249C7]" /> },
          ]}
        />
      </div>

      {/* ─── Ledger ─── */}
      {visible.length === 0 ? (
        <div className="app-glass rounded-2xl p-12 text-center">
          <div className="font-serif text-[18px] font-bold text-ink">{rows.length === 0 ? "No transactions yet" : "Nothing matches"}</div>
          <p className="text-[12.5px] text-ink-dim mt-1.5">
            {rows.length === 0 ? (
              <>Your first checkout will appear here. <a href="/billing" className="text-polaris-600 dark:text-polaris-300 font-medium hover:underline">Go to billing →</a></>
            ) : "Try clearing a filter or the search."}
          </p>
        </div>
      ) : (
        <motion.ul
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.035 } } }}
          className="space-y-2"
        >
          {visible.map((t) => {
            const sm = STATUS_META[t.status];
            return (
              <motion.li key={t.id} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}>
                <button
                  onClick={() => setOpenId(t.id)}
                  className="w-full app-glass rounded-2xl px-4 py-3 flex items-center gap-3.5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all group"
                >
                  {t.method === "card" && t.cardBrand ? (
                    <span className="h-9 w-12 rounded-lg inline-flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                      style={{ background: "linear-gradient(135deg, #1F2937 0%, #4B5563 120%)" }}>
                      <CardBrandMark brand={t.cardBrand} height={t.cardBrand === "mastercard" ? 16 : 10} />
                    </span>
                  ) : (
                    <PaymentLogo method={t.method} className="group-hover:scale-105 transition-transform h-9 w-12" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink truncate">{t.description}</div>
                    <div className="text-[10.5px] font-mono text-ink-muted mt-0.5">
                      {t.reference}{t.maskedAccount ? ` · ${t.maskedAccount}` : ""} · {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <span className="font-mono text-[13.5px] font-semibold text-ink tabular-nums shrink-0">{money(t.amount, t.currency)}</span>
                  <span className={cn("text-[9px] uppercase tracking-wider font-bold rounded-full px-2 py-[3px] ring-1 ring-inset inline-flex items-center gap-1.5 shrink-0", sm.cls)}>
                    <span className={cn("h-1 w-1 rounded-full", sm.dot)} /> {sm.label}
                  </span>
                  <span className="text-ink-muted shrink-0 hidden sm:block"><Icon.chev size={12} /></span>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <AnimatePresence>
        {open && <TxModal key={open.id} t={open} userName={userName} userEmail={userEmail} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ─── stat card ─── */

function StatCard({ label, value, sub, tone, delay }: { label: string; value: string; sub: string; tone: "polaris" | "aurora" | "rose" | "ink"; delay: number }) {
  const bar = {
    polaris: "from-polaris-300 to-polaris-500",
    aurora: "from-aurora-300 to-aurora-500",
    rose: "from-rose-300 to-rose-500",
    ink: "from-ink/20 to-ink/60",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className="app-glass rounded-2xl p-4 relative overflow-hidden"
    >
      <div className={cn("absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r", bar)} />
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className="font-serif text-[22px] font-bold text-ink mt-1 tabular-nums truncate">{value}</div>
      <div className="text-[10.5px] text-ink-muted mt-0.5">{sub}</div>
    </motion.div>
  );
}

/* ─── detail modal + receipt ─── */

function TxModal({ t, userName, userEmail, onClose }: { t: TxDto; userName: string; userEmail: string; onClose: () => void }) {
  const sm = STATUS_META[t.status];

  function printReceipt() {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Polaris receipt ${t.reference}</title>
<style>
  body { font-family: Georgia, serif; margin: 0; padding: 32px; color: #2A2018; }
  .head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #2A2018; padding-bottom: 12px; }
  .brand { font-size: 22px; font-weight: bold; letter-spacing: -0.5px; }
  .tag { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #8B7355; }
  table { width: 100%; margin-top: 20px; border-collapse: collapse; font-size: 13px; font-family: system-ui, sans-serif; }
  td { padding: 7px 0; border-bottom: 1px solid #E8DFD3; }
  td:last-child { text-align: right; font-weight: 600; }
  .total { font-size: 16px; }
  .note { margin-top: 24px; font-size: 10.5px; color: #8B7355; font-family: system-ui, sans-serif; line-height: 1.5; }
</style></head><body>
  <div class="head"><span class="brand">✦ Polaris</span><span class="tag">Receipt</span></div>
  <table>
    <tr><td>Invoice</td><td>${t.reference}</td></tr>
    <tr><td>Date</td><td>${new Date(t.createdAt).toLocaleString()}</td></tr>
    <tr><td>Billed to</td><td>${userName} (${userEmail})</td></tr>
    <tr><td>Item</td><td>${t.description}</td></tr>
    <tr><td>Method</td><td>${t.method === "card" ? (t.cardBrand ?? "Card") : t.method}${t.maskedAccount ? " " + t.maskedAccount : ""}</td></tr>
    <tr><td>Status</td><td>${sm.label}</td></tr>
    <tr class="total"><td>Total</td><td>${money(t.amount, t.currency)}</td></tr>
  </table>
  <p class="note">Sandbox transaction - no real funds moved. Polaris · the admissions intelligence layer.<br/>Questions? Reply to your welcome email or visit the Help section.</p>
  <script>window.print();</scr` + `ipt>
</body></html>`);
    w.document.close();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 14, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] max-h-[88vh] overflow-y-auto rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* receipt header */}
        <div className="px-6 pt-6 pb-5 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #3D2A1A 0%, #5C3D26 55%, #8B5E3C 120%)" }}>
          <button onClick={onClose} aria-label="Close"
            className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
            <Icon.close size={13} />
          </button>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold">Receipt</div>
          <div className="mt-1 font-serif text-[20px] font-bold leading-tight">{t.description}</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-[30px] font-bold tabular-nums leading-none">{money(t.amount, t.currency)}</span>
            <span className={cn("text-[9px] uppercase tracking-wider font-bold rounded-full px-2 py-[3px] ring-1 ring-inset", sm.cls)}>{sm.label}</span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-1.5 text-[12.5px]">
          <DetailRow k="Reference" v={t.reference} mono />
          <DetailRow k="Date" v={new Date(t.createdAt).toLocaleString()} mono />
          <DetailRow k="Method" v={`${t.method === "card" ? (t.cardBrand ?? "Card") : t.method}${t.maskedAccount ? ` ${t.maskedAccount}` : ""}`} />
          <DetailRow k="Billed to" v={userName} />
          <DetailRow k="Currency" v={t.currency} mono />
          {t.failureReason && <DetailRow k="Failure reason" v={t.failureReason} alert />}
          <div className="pt-3 mt-3 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center justify-between">
            <span className="font-semibold text-ink">Total</span>
            <span className="font-serif text-[17px] font-bold text-ink tabular-nums">{money(t.amount, t.currency)}</span>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center gap-2">
          {t.status === "succeeded" && (
            <button onClick={printReceipt}
              className="flex-1 h-10 rounded-full bg-ink text-paper text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors">
              Print / save receipt
            </button>
          )}
          <button onClick={onClose}
            className={cn("h-10 rounded-full bg-paper-soft text-ink text-[12.5px] font-medium hairline hover:bg-paper-deep transition-colors", t.status === "succeeded" ? "px-5" : "flex-1")}>
            Close
          </button>
        </div>
        <div className="px-6 pb-5 -mt-1 text-[10px] text-ink-muted text-center">
          Sandbox transaction - no real funds moved.
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailRow({ k, v, mono, alert }: { k: string; v: string; mono?: boolean; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-muted">{k}</span>
      <span className={cn("text-right truncate", mono && "font-mono text-[11.5px]", alert ? "text-rose-600 dark:text-rose-300 font-medium" : "text-ink")}>{v}</span>
    </div>
  );
}
