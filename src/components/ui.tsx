import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="bg-coal text-cream">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        {eyebrow && <p className="text-copper-2 uppercase tracking-[0.18em] text-xs font-medium mb-3">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-5xl font-semibold leading-tight max-w-4xl">{title}</h1>
        {children && <div className="mt-4 text-cream/80 max-w-3xl text-base sm:text-lg leading-relaxed">{children}</div>}
      </div>
    </section>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Card({ children, className = "", title, kicker }: { children: ReactNode; className?: string; title?: string; kicker?: string }) {
  return (
    <section className={`bg-white/70 border border-rule rounded-lg p-4 sm:p-5 ${className}`}>
      {kicker && <p className="text-[11px] uppercase tracking-[0.14em] text-copper font-medium mb-1">{kicker}</p>}
      {title && <h2 className="text-xl font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, testid }: { label: string; value: ReactNode; note?: ReactNode; testid?: string }) {
  return (
    <div className="border-l-2 border-copper pl-3 py-1" data-testid={testid}>
      <div className="num text-2xl sm:text-3xl font-medium text-ink">{value}</div>
      <div className="text-sm text-muted mt-0.5">{label}</div>
      {note && <div className="text-xs text-muted/80 mt-1">{note}</div>}
    </div>
  );
}

const QDESC: Record<string, string> = {
  A: "Verified: same count read from two independent printings, visually checked, or an official digital count",
  B: "Single printing; at least 4 of 5 OCR readings agree (not used in models)",
  C: "Uncertain: weak OCR agreement, disagreement between printings, or inconsistent with neighbours (not used)",
};
export function QualityBadge({ q }: { q: string }) {
  const cls = q === "A" ? "bg-sage text-white" : q === "B" ? "bg-sand text-ink" : "bg-rail/15 text-rail";
  return <span title={QDESC[q]} className={`inline-block num text-[11px] px-1.5 py-0.5 rounded ${cls}`}>{q}</span>;
}

export function KindTag({ kind }: { kind: "Observed fact" | "Computed result" | "Historical interpretation" | "Uncertain inference" }) {
  const map = {
    "Observed fact": "bg-sage/15 text-sage border-sage/40",
    "Computed result": "bg-slate/10 text-slate border-slate/40",
    "Historical interpretation": "bg-copper/10 text-copper border-copper/40",
    "Uncertain inference": "bg-rail/10 text-rail border-rail/40",
  } as const;
  return <span className={`inline-block text-[10px] uppercase tracking-wider border px-1.5 py-0.5 rounded ${map[kind]}`}>{kind}</span>;
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-copper underline decoration-copper/40 hover:decoration-copper">{children}<span aria-hidden="true"> ↗</span></a>;
}

export function Btn({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  return (
    <Link href={href} className={variant === "primary"
      ? "inline-flex items-center gap-2 bg-copper hover:bg-copper-2 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
      : "inline-flex items-center gap-2 border border-current px-4 py-2.5 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"}>
      {children}
    </Link>
  );
}

export const fmt = (n: number | null | undefined, d = 0) => (n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
export const logpct = (g: number | null | undefined) => (g == null ? "—" : `${g >= 0 ? "+" : ""}${((Math.exp(g) - 1) * 100).toFixed(0)}%`);
