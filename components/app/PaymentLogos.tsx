/**
 * Payment brand marks - bKash, Nagad, Rocket, and card networks.
 *
 * Hand-drawn vector recreations in each brand's real colors (bKash magenta
 * #E2136E, Nagad red→orange, Rocket purple #8C3494, Mastercard interlocking
 * circles, Visa wordmark, Amex panel) so checkout, saved methods, and the
 * transactions ledger all show recognizable marks instead of generic glyphs.
 * SVG, not rasters - crisp at any size, no licensing baggage from bundling
 * official asset files.
 */

import { cn } from "@/lib/cn";

export type PayMethod = "card" | "bkash" | "nagad" | "rocket";

export const PAYMENT_BRAND: Record<PayMethod, { name: string; bg: string }> = {
  card:   { name: "Card",   bg: "linear-gradient(135deg, #1F2937 0%, #4B5563 120%)" },
  bkash:  { name: "bKash",  bg: "linear-gradient(135deg, #C00F5C 0%, #E2136E 70%, #F0468E 130%)" },
  nagad:  { name: "Nagad",  bg: "linear-gradient(135deg, #C81118 0%, #ED1C24 55%, #F7941D 140%)" },
  rocket: { name: "Rocket", bg: "linear-gradient(135deg, #5E2074 0%, #8C3494 70%, #A65BB0 130%)" },
};

/** The white brand mark alone (rendered on a brand-colored surface). */
export function PaymentMark({ method, size = 16 }: { method: PayMethod; size?: number }) {
  switch (method) {
    case "bkash":
      // The bKash origami bird, simplified.
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M2.6 13.4 14 3.2l-1.5 6.1 8.9-1.7-7.5 5.9 2.2 7.3-7.2-5.4-4.4 3z" />
        </svg>
      );
    case "nagad":
      // Nagad's rhombus pinwheel motif.
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 1.8 17.1 7 12 12.2 6.9 7z" fill="#fff" />
          <path d="M17.1 7 22.2 12.2 17.1 17.4 12 12.2z" fill="#fff" opacity=".82" />
          <path d="M12 12.2 17.1 17.4 12 22.6 6.9 17.4z" fill="#fff" opacity=".66" />
          <path d="M6.9 7 12 12.2 6.9 17.4 1.8 12.2z" fill="#fff" opacity=".82" />
        </svg>
      );
    case "rocket":
      // Dutch-Bangla's Rocket - a literal rocket with porthole + fins.
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M12 1.6c3.3 1.7 5.2 5.2 5.2 9.2 0 1.1-.15 2.2-.45 3.2l-2.1-1.1c-.5 1.6-1.4 3-2.65 4.1-1.25-1.1-2.15-2.5-2.65-4.1l-2.1 1.1c-.3-1-.45-2.1-.45-3.2 0-4 1.9-7.5 5.2-9.2z" />
          <circle cx="12" cy="8.6" r="1.7" fill="#8C3494" />
          <path d="M8.2 16.4 6 21l3.4-1.6zM15.8 16.4 18 21l-3.4-1.6zM12 18.2l1.1 3.6h-2.2z" />
        </svg>
      );
    case "card":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10.5h18" />
        </svg>
      );
  }
}

/** Brand tile - mark on its real brand gradient. */
export function PaymentLogo({
  method, size = "md", className,
}: {
  method: PayMethod;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "sm" ? { h: 22, w: 30, mark: 12 } : size === "lg" ? { h: 36, w: 50, mark: 20 } : { h: 28, w: 40, mark: 16 };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg shrink-0",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_3px_8px_-3px_rgba(0,0,0,0.45)]",
        className,
      )}
      style={{ background: PAYMENT_BRAND[method].bg, height: px.h, width: px.w }}
      aria-label={PAYMENT_BRAND[method].name}
    >
      <PaymentMark method={method} size={px.mark} />
    </span>
  );
}

/** Card-network mark for the faux card preview + saved cards. */
export function CardBrandMark({ brand, height = 14 }: { brand: string | null; height?: number }) {
  switch ((brand ?? "").toLowerCase()) {
    case "visa":
      return (
        <svg height={height} viewBox="0 0 48 16" aria-label="Visa">
          <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="800" fontStyle="italic" fill="#fff" letterSpacing="0.5">VISA</text>
        </svg>
      );
    case "mastercard":
      return (
        <svg height={height} viewBox="0 0 36 22" aria-label="Mastercard">
          <circle cx="13" cy="11" r="10" fill="#EB001B" />
          <circle cx="23" cy="11" r="10" fill="#F79E1B" />
          <path d="M18 3.1a10 10 0 0 1 0 15.8 10 10 0 0 1 0-15.8z" fill="#FF5F00" />
        </svg>
      );
    case "amex":
      return (
        <svg height={height} viewBox="0 0 42 16" aria-label="American Express">
          <rect width="42" height="16" rx="2.5" fill="#2E77BC" />
          <text x="21" y="11.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.5" fontWeight="800" fill="#fff" letterSpacing="0.4">AMEX</text>
        </svg>
      );
    case "discover":
      return (
        <svg height={height} viewBox="0 0 42 16" aria-label="Discover">
          <text x="0" y="12" fontFamily="Arial, Helvetica, sans-serif" fontSize="10" fontWeight="800" fill="#fff">DISC</text>
          <circle cx="36" cy="8" r="5.5" fill="#F58220" />
        </svg>
      );
    default:
      return <span className="text-[10px] uppercase tracking-wider text-white/55 font-medium">Card</span>;
  }
}
