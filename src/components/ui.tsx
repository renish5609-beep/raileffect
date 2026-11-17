import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="bg-coal text-cream relative overflow-hidden">
      <TrackOrnament />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-14">
        <h1 className="text-[2.6rem] sm:text-[4rem] max-w-5xl text-balance" data-section={eyebrow}>{title}</h1>
        {children && <div className="mt-5 text-cream/80 max-w-[62ch] text-[1.08rem] leading-relaxed">{children}</div>}
      </div>
    </section>
  );
}

/** Thin ruled track running along the bottom of dark headers: rails + ties, the site's one recurring motif. */
export function TrackOrnament() {
  return (
    <svg aria-hidden="true" className="absolute bottom-0 left-0 w-full h-[14px] opacity-60" preserveAspectRatio="none" viewBox="0 0 1200 14">
      <defs>
        <pattern id="ties" width="22" height="14" patternUnits="userSpaceOnUse"><rect x="9" y="1" width="3" height="12" fill="#3a4252" /></pattern>
      </defs>
      <rect width="1200" height="14" fill="url(#ties)" />
      <rect y="3" width="1200" height="1.5" fill="#a3262a" />
      <rect y="9.5" width="1200" height="1.5" fill="#a3262a" />
    </svg>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** A content section: heavy top rule and a heading, no box or shadow. `kicker` is kept for API compatibility but not shown. */
export function Card({ children, className = "", title }: { children: ReactNode; className?: string; title?: string; kicker?: string }) {
  return (
    <section className={`border-t-2 border-ink pt-4 ${className}`}>
      {title && <h2 className="text-[1.65rem] mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, testid }: { label: string; value: ReactNode; note?: ReactNode; testid?: string }) {
  return (
    <div className="py-1" data-testid={testid}>
      <div className="font-serif font-semibold text-[2.6rem] sm:text-[3.2rem] leading-none text-ink" style={{ fontVariantNumeric: "proportional-nums" }}>{value}</div>
      <div className="ui text-[0.95rem] text-ink mt-2 max-w-[24ch] leading-snug">{label}</div>
      {note && <div className="ui text-[0.82rem] text-muted mt-1">{note}</div>}
    </div>
  );
}

const QDESC: Record<string, string> = {
  A: "Verified: same count read from two independent printings, visually checked, or an official digital count",
  B: "Single printing; at least 4 of 5 OCR readings agree (not used in models)",
  C: "Uncertain: weak OCR agreement, disagreement between printings, or inconsistent with neighbours (not used)",
};
export function QualityBadge({ q }: { q: string }) {
  const cls = q === "A" ? "bg-sage text-white" : q === "B" ? "bg-sand text-ink border border-rule" : "bg-transparent text-rail border border-rail/50";
  return <span title={QDESC[q]} aria-label={`Grade ${q}: ${QDESC[q]}`} className={`inline-grid place-items-center w-6 h-6 ui text-[12px] font-semibold rounded-sm ${cls}`}>{q}</span>;
}

const KIND_COLOR = {
  "Observed fact": "#71834f",
  "Computed result": "#2d5b88",
  "Historical interpretation": "#8a5a1e",
  "Uncertain inference": "#a3262a",
} as const;
type Kind = keyof typeof KIND_COLOR;

/** Evidence-type label. Use inside an <Evidence> block, or alone for inline use. */
export function KindTag({ kind }: { kind: Kind }) {
  return <span className="evidence-kind block mt-4 first:mt-0" style={{ ["--note" as string]: KIND_COLOR[kind] }}>{kind}</span>;
}

export function Evidence({ kind, children }: { kind: Kind; children: ReactNode }) {
  return (
    <div className="evidence" style={{ ["--note" as string]: KIND_COLOR[kind] }}>
      <span className="evidence-kind">{kind}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="link">{children}<span className="sr-only"> (opens in a new tab)</span></a>;
}

export function Btn({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  return (
    <Link href={href} className={variant === "primary"
      ? "ui inline-flex items-center bg-copper hover:bg-copper-2 text-white px-5 py-3 rounded-sm text-[1rem] font-semibold transition-colors duration-200"
      : "ui inline-flex items-center border-2 border-current px-5 py-[10px] rounded-sm text-[1rem] font-semibold hover:bg-white/10 transition-colors duration-200"}>
      {children}
    </Link>
  );
}

export const fmt = (n: number | null | undefined, d = 0) => (n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
export const logpct = (g: number | null | undefined) => (g == null ? "—" : `${g >= 0 ? "+" : ""}${((Math.exp(g) - 1) * 100).toFixed(0)}%`);
