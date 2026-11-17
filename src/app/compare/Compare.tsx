"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PopChart from "@/components/PopChart";
import { fmt, logpct } from "@/components/ui";
import type { Town } from "@/lib/types";

type I = { id: string; name: string; county: string };

function Picker({ label, value, index, onChange, testid }: { label: string; value: string; index: I[]; onChange: (id: string) => void; testid: string }) {
  return (
    <label className="text-sm block">{label}
      <select data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} className="block mt-1 w-full border border-rule rounded-md px-2 py-2 bg-white">
        <option value="">Choose a town…</option>
        {index.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.county})</option>)}
      </select>
    </label>
  );
}

export default function Compare({ index }: { index: I[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [a, setA] = useState(sp.get("a") || "");
  const [b, setB] = useState(sp.get("b") || "");
  const [ta, setTa] = useState<Town | null>(null);
  const [tb, setTb] = useState<Town | null>(null);
  const [log, setLog] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { router.replace(`/compare?${new URLSearchParams({ ...(a ? { a } : {}), ...(b ? { b } : {}) })}`, { scroll: false }); }, [a, b, router]);
  useEffect(() => {
    const load = async (id: string, set: (t: Town | null) => void) => {
      if (!id) return set(null);
      try { const r = await fetch(`/data/towns/${id}.json`); if (!r.ok) throw new Error(); set(await r.json()); } catch { setErr("Could not load town data."); }
    };
    load(a, setTa); load(b, setTb);
  }, [a, b]);
  const rows: [string, (t: Town) => string][] = [
    ["County", (t) => t.county],
    ["First benchmark with track ≤ 2 km", (t) => String(t.first_served_benchmark ?? "none by 1911")],
    ["Track ≤ 2 km in 2020", (t) => (t.served_2020 ? "yes" : "no")],
    ["Verified 1940 population", (t) => fmt(t.pops.find((p) => p.year === 1940 && p.quality === "A")?.pop)],
    ["Verified 1960 population", (t) => fmt(t.pops.find((p) => p.year === 1960 && p.quality === "A")?.pop)],
    ["2020 population", (t) => fmt(t.pop2020)],
    ["Change 1940–2020", (t) => logpct(t.outcomes.growth_1940_2020)],
    ["Network km to 1910 hub (1911)", (t) => fmt(t.metrics.hub_net_km_1911, 1)],
    ["Graph degree (1911)", (t) => fmt(t.metrics.node_degree_1911)],
    ["km to 2020 Interstate", (t) => fmt(t.metrics.dist_interstate_km, 1)],
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <p className="text-copper uppercase tracking-[0.18em] text-xs font-medium">Compare</p>
      <h1 className="text-3xl font-semibold mb-5">Two towns, side by side</h1>
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <Picker label="Town A" value={a} index={index} onChange={setA} testid="pick-a" />
        <Picker label="Town B" value={b} index={index} onChange={setB} testid="pick-b" />
      </div>
      {err && <p role="alert" className="text-rail">{err}</p>}
      {(ta || tb) && (
        <>
          <div className="bg-white/70 border border-rule rounded-lg p-4" data-testid="compare-chart">
            <label className="text-sm flex items-center gap-2 mb-2"><input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> Log scale</label>
            <PopChart series={[ta, tb].filter(Boolean).map((t) => ({ name: (t as Town).name, pops: (t as Town).pops }))} log={log} height={340} />
          </div>
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm bg-white/70 border border-rule rounded-lg" data-testid="compare-table">
              <thead><tr className="bg-sand/60 text-left"><th className="p-2">Measure</th><th className="p-2">{ta ? <Link className="underline" href={`/towns/${ta.id}`}>{ta.name}</Link> : "—"}</th><th className="p-2">{tb ? <Link className="underline" href={`/towns/${tb.id}`}>{tb.name}</Link> : "—"}</th></tr></thead>
              <tbody>{rows.map(([k, f]) => <tr key={k} className="border-t border-rule"><td className="p-2 text-muted">{k}</td><td className="p-2 num">{ta ? f(ta) : "—"}</td><td className="p-2 num">{tb ? f(tb) : "—"}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-3">A difference between two towns is a description, not an estimate of the effect of railroads: towns differ in many ways the data do not capture.</p>
        </>
      )}
    </div>
  );
}
