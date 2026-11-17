import Link from "next/link";
import { getSummary, getModels, readJson } from "@/lib/data";
import { Container, Stat, Btn, Evidence, TrackOrnament, fmt } from "@/components/ui";
import HeroMap from "@/components/HeroMap";

const SECTIONS = [
  { href: "/explorer", label: "Railroad Explorer", text: "Step through every documented network map and inspect where each line came from." },
  { href: "/towns", label: "Towns", text: "Each town’s census history, with the page every number was read from." },
  { href: "/compare?a=denison-grayson&b=sherman-grayson", label: "Compare two towns", text: "Put any two towns’ populations and rail access side by side." },
  { href: "/lab", label: "Research Lab", text: "The models, their diagnostics, and how far the results bend under other choices." },
  { href: "/case-studies", label: "Case studies", text: "Pairs of real towns, picked by rule, with the explanations that compete with rail." },
  { href: "/methodology", label: "Methodology and data", text: "How the census scans were read and checked, and every file to reproduce or correct the work." },
];

export default function Home() {
  const s = getSummary(), m = getModels();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = readJson<any[]>("towns_index.json").map((t) => ({ id: t.id, name: t.name, county: t.county, lat: t.lat, lon: t.lon, firstServed: t.firstServed }));
  const b1 = s.headline.b1_served1911, dm = s.headline.diff_mean_g40_20;
  const rob = m.robustness.filter((r: { coef?: number }) => r.coef != null);
  const inc0 = rob.filter((r: { ci_low: number; ci_high: number }) => r.ci_low <= 0 && r.ci_high >= 0).length;
  return (
    <>
      <section className="bg-coal text-cream relative overflow-hidden">
        <Container className="pt-10 pb-12 sm:pt-14 sm:pb-16 grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-start">
          <div className="lg:pt-6">
            <h1 className="text-[3rem] sm:text-[4.6rem] lg:text-[5.2rem] leading-[0.95] text-balance">Did the railroad decide which Texas towns grew?</h1>
            <p className="mt-6 text-[1.12rem] text-cream/80 leading-relaxed max-w-[48ch]">
              RailEffect lines up fifty years of Texas railroad maps with town populations read from the original census volumes, then tests whether early track predicts which towns grew, shrank or held on.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/findings">See what we found</Btn>
              <Btn href="/explorer" variant="ghost">Explore the network</Btn>
            </div>
          </div>
          <HeroMap towns={idx} years={s.benchmark_years} trackKm={s.texas_track_km_by_benchmark} />
        </Container>
        <TrackOrnament />
      </section>

      <Container className="pt-14 grid lg:grid-cols-[1.1fr_0.9fr] gap-12">
        <section aria-labelledby="answer">
          <h2 id="answer" className="text-[2.4rem] sm:text-[3rem] max-w-[20ch] text-balance">Rail towns grew faster, but track alone doesn’t explain it.</h2>
          <div className="mt-6 space-y-5 text-[1.06rem] max-w-[62ch]">
            <Evidence kind="Computed result">
              <p>Towns with track within 2 km by 1911 grew {dm.served_minus_not.toFixed(2)} log points more between 1940 and 2020 than towns without (95% interval {dm.ci[0].toFixed(2)} to {dm.ci[1].toFixed(2)}).</p>
            </Evidence>
            <Evidence kind="Computed result">
              <p>Once 1940 size and location are accounted for, the gap falls to {b1.coef.toFixed(2)} (interval {b1.ci_low.toFixed(2)} to {b1.ci_high.toFixed(2)}). In {inc0} of {rob.length} alternative specifications the interval still includes zero.</p>
            </Evidence>
            <Evidence kind="Uncertain inference">
              <p>Closeness to the big 1910 cities and to the later Interstates tracks growth more closely. Every town here had already incorporated, so places the railroad bypassed before they became towns are missing.</p>
            </Evidence>
          </div>
          <Link href="/lab" className="link inline-block mt-6 ui font-semibold">Read the models in the Research Lab</Link>
        </section>
        <section aria-label="Scale of the evidence" className="grid grid-cols-2 gap-x-8 gap-y-8 content-start border-t-2 border-ink pt-6" data-testid="home-stats">
          <Stat label="Texas towns located and traced through the census" value={fmt(s.towns_analyzed)} />
          <Stat label="Track segments from Atack’s maps" value={fmt(s.rail_segments_texas)} />
          <Stat label="Network maps, 1861 to 1911, plus today" value={s.benchmark_years.length} />
          <Stat label="Population figures checked or agreed by OCR" value={fmt(s.population_observations_ab)} />
        </section>
      </Container>

      <Container className="pt-16">
        <h2 className="text-[2rem] border-t-2 border-ink pt-4">Where to go next</h2>
        <ul className="mt-4 grid md:grid-cols-2 gap-x-12">
          {SECTIONS.map((x) => (
            <li key={x.href} className="border-b border-rule">
              <Link href={x.href} className="group grid gap-1 py-4">
                <span className="font-serif text-[1.45rem] font-semibold group-hover:text-copper transition-colors">{x.label}</span>
                <span className="text-muted max-w-[52ch]">{x.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
