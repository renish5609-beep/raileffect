"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt, logpct } from "@/components/ui";

type R = { id: string; name: string; county: string; firstServed: number | null; served1911: boolean; served2020: boolean; pop1940: number | null; pop2020: number | null; g4020: number | null; zone: string; era: string; persisted: boolean };

export default function TownTable({ rows }: { rows: R[] }) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [rail, setRail] = useState("");
  const [sort, setSort] = useState<"name" | "pop1940" | "pop2020" | "g4020" | "firstServed">("name");
  const [desc, setDesc] = useState(false);
  const [n, setN] = useState(60);
  const list = useMemo(() => {
    let r = rows.filter((t) => (!q || `${t.name} ${t.county}`.toLowerCase().includes(q.toLowerCase())) && (!zone || t.zone === zone) &&
      (!rail || (rail === "served" ? t.served1911 : rail === "unserved" ? !t.served1911 : rail === "lost" ? t.served1911 && !t.served2020 : true)));
    r = [...r].sort((a, b) => {
      const va = a[sort], vb = b[sort];
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return desc ? -c : c;
    });
    return r;
  }, [rows, q, zone, rail, sort, desc]);
  const th = (k: typeof sort, label: string) => (
    <th scope="col" className="py-2 px-2 text-left font-medium">
      <button onClick={() => { setDesc(sort === k ? !desc : false); setSort(k); }} className="hover:text-copper">{label}{sort === k ? (desc ? " ↓" : " ↑") : ""}</button>
    </th>
  );
  return (
    <div>
      <div className="ui flex flex-wrap gap-4 items-end mb-6">
        <label className="text-sm">Search<input data-testid="towns-search" type="search" name="q" autoComplete="off" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Town or county…" className="block mt-1 border-2 border-rule focus:border-ink rounded-sm px-3 py-2 bg-white w-64 max-w-full" /></label>
        <label className="text-sm">Region<select value={zone} onChange={(e) => setZone(e.target.value)} className="block mt-1 border-2 border-rule rounded-sm px-2 py-2 bg-white"><option value="">All</option><option>East</option><option>Central</option><option>West</option></select></label>
        <label className="text-sm">Rail access<select value={rail} onChange={(e) => setRail(e.target.value)} className="block mt-1 border-2 border-rule rounded-sm px-2 py-2 bg-white">
          <option value="">All</option><option value="served">Track ≤ 2 km by 1911</option><option value="unserved">No track ≤ 2 km by 1911</option><option value="lost">Track by 1911, none ≤ 2 km in 2020</option></select></label>
        <p className="text-sm text-muted ml-auto" aria-live="polite">{list.length.toLocaleString()} towns</p>
      </div>
      <div className="overflow-x-auto border-t-2 border-ink ui">
        <table className="w-full text-sm">
          <thead className="border-b border-ink"><tr>{th("name", "Town")}<th className="py-2 px-2 text-left font-medium">County</th>{th("firstServed", "Rail by")}{th("pop1940", "1940")}{th("pop2020", "2020")}{th("g4020", "Change 1940–2020")}</tr></thead>
          <tbody>
            {list.slice(0, n).map((t) => (
              <tr key={t.id} className="border-t border-rule hover:bg-sand/60">
                <td className="py-1.5 px-2"><Link className="link" href={`/towns/${t.id}`}>{t.name}</Link>{!t.persisted && <span className="ml-1 text-[10px] text-rail" title="Not a census place in 2020">●</span>}</td>
                <td className="px-2">{t.county}</td>
                <td className="px-2 num">{t.firstServed ?? "—"}</td>
                <td className="px-2 num">{fmt(t.pop1940)}</td>
                <td className="px-2 num">{fmt(t.pop2020)}</td>
                <td className="px-2 num">{logpct(t.g4020)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {n < list.length && <button onClick={() => setN(n + 120)} className="ui mt-4 font-semibold border-2 border-ink px-4 py-2 rounded-sm hover:bg-ink hover:text-cream transition-colors">Show more</button>}
      <p className="text-xs text-muted mt-3">“Rail by” = first Atack benchmark map with track within 2 km of the town point. 1940 values shown only when verified (quality A). <span className="text-rail">●</span> not a census place in 2020.</p>
    </div>
  );
}
