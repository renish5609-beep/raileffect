"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const NAV = [
  { href: "/explorer", label: "Railroad Explorer" },
  { href: "/towns", label: "Towns" },
  { href: "/lab", label: "Research Lab" },
  { href: "/findings", label: "Findings" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/methodology", label: "Methodology" },
  { href: "/data", label: "Data" },
];

function Mark() {
  return (
    <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
      <path d="M2 7 H28 M2 15 H28" stroke="#d0484a" strokeWidth="2" />
      {[5, 11, 17, 23].map((x) => <rect key={x} x={x} y="3" width="2.4" height="16" fill="#eceee6" />)}
    </svg>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (h: string) => path.startsWith(h);
  return (
    <header className="bg-coal text-cream sticky top-0 z-40 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="RailEffect home">
          <Mark />
          <span className="font-serif text-[1.45rem] font-bold leading-none">RailEffect</span>
        </Link>
        <nav aria-label="Primary" className="hidden lg:flex items-stretch h-full">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`relative flex items-center px-3 text-[0.98rem] font-medium transition-colors ${active(n.href) ? "text-white" : "text-cream/70 hover:text-white"}`}>
              {n.label}
              <span aria-hidden="true" className={`absolute left-3 right-3 bottom-0 h-[3px] bg-copper-2 transition-transform duration-300 origin-left ${active(n.href) ? "scale-x-100" : "scale-x-0"}`} />
            </Link>
          ))}
        </nav>
        <button className="lg:hidden text-cream px-3 py-1.5 border border-white/25 rounded-sm text-sm font-semibold" aria-expanded={open}
          aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      </div>
      <nav id="mobile-nav" aria-label="Primary mobile" hidden={!open} className="lg:hidden border-t border-white/10 px-4 pb-4 pt-1 bg-coal">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`block py-2.5 text-[1.05rem] border-b border-white/5 ${active(n.href) ? "text-copper-2" : "text-cream/90"}`}>{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}
