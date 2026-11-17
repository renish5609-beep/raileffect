import Link from "next/link";
import { getSummary, getModels, readJson } from "@/lib/data";
import { Container, Stat, Btn, KindTag, fmt } from "@/components/ui";
import HeroMap from "@/components/HeroMap";

export default function Home() {
  const s = getSummary(), m = getModels();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = readJson<any[]>("towns_index.json").map((t) => ({ id: t.id, name: t.name, county: t.county, lat: t.lat, lon: t.lon, firstServed: t.firstServed }));
  const b1 = s.headline.b1_served1911, dm = s.headline.diff_mean_g40_20;
  return (
    <>
      <section className="bg-coal text-cream">
        <Container className="py-10 sm:py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-copper-2 uppercase tracking-[0.2em] text-xs font-medium mb-4">Computational history · Texas, 1861–2020</p>
            <h1 className="text-4xl sm:text-6xl font-semibold leading-[1.05]">Did railroads decide which Texas towns thrived?</h1>
            <p className="mt-5 text-lg text-cream/80 leading-relaxed max-w-xl">RailEffect links Jeremy Atack’s historical railroad GIS to census population tables digitised and verified for this project, then tests whether early rail access predicts which towns grew, shrank or persisted.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Btn href="/findings">Explore the findings</Btn>
              <Btn href="/explorer" variant="ghost">Open the Railroad Explorer</Btn>
            </div>
          </div>
          <div>
            <HeroMap towns={idx} years={s.benchmark_years} trackKm={s.texas_track_km_by_benchmark} />
          </div>
        </Container>
      </section>
      <Container className="py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6" data-testid="home-stats">
          <Stat label="Texas towns located and analysed" value={fmt(s.towns_analyzed)} />
          <Stat label="Historical track segments (Atack)" value={fmt(s.rail_segments_texas)} />
          <Stat label="Network snapshots" value={`${s.benchmark_years.length}`} note={`${s.benchmark_years[0]}–${s.benchmark_years[s.benchmark_years.length - 1]} + 2020`} />
          <Stat label="Verified or consensus population values" value={fmt(s.population_observations_ab)} />
        </div>
      </Container>
      <Container className="pb-12 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/70 border border-rule rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-copper font-medium">Current answer</p>
          <h2 className="text-2xl font-semibold mt-1">Rail towns grew faster — but rail access alone does not explain it</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed">
            <p><KindTag kind="Computed result" /> Towns with track within 2 km by 1911 grew {dm.served_minus_not.toFixed(2)} log points more from 1940 to 2020 than towns without (95% CI {dm.ci[0].toFixed(2)} to {dm.ci[1].toFixed(2)}).</p>
            <p><KindTag kind="Computed result" /> After accounting for 1940 size and location, the estimate shrinks to {b1.coef.toFixed(2)} (95% CI {b1.ci_low.toFixed(2)} to {b1.ci_high.toFixed(2)}), consistent with no independent association, across {m.robustness.length} robustness checks.</p>
            <p><KindTag kind="Uncertain inference" /> Proximity to large cities and to the later Interstate network is more strongly associated with growth. These are associations in a sample of towns that had already incorporated; they do not establish what railroads caused.</p>
          </div>
          <Link href="/lab" className="inline-block mt-5 text-copper underline">See the models in the Research Lab →</Link>
        </div>
        <div className="bg-coal text-cream rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-copper-2 font-medium">How to use this site</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li><Link className="underline" href="/explorer">Railroad Explorer</Link> — step through documented network snapshots.</li>
            <li><Link className="underline" href="/towns">Towns</Link> — each town’s census history with page-level citations.</li>
            <li><Link className="underline" href="/compare?a=denison-grayson&b=sherman-grayson">Compare</Link> — two towns side by side.</li>
            <li><Link className="underline" href="/case-studies">Case studies</Link> — paired towns chosen by rule.</li>
            <li><Link className="underline" href="/methodology">Methodology</Link> and <Link className="underline" href="/data">Data</Link> — reproduce or correct the work.</li>
          </ul>
        </div>
      </Container>
    </>
  );
}
