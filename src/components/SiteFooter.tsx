import Link from "next/link";
import { TrackOrnament } from "./ui";

export function SiteFooter() {
  return (
    <footer className="bg-coal text-cream/75 mt-20 relative">
      <div className="rotate-180"><TrackOrnament /></div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-10 grid gap-10 md:grid-cols-[1.3fr_1fr_1fr] ui text-[0.95rem]">
        <div>
          <p className="font-serif text-cream text-2xl font-bold mb-2">RailEffect</p>
          <p className="max-w-[46ch] leading-relaxed">An open-source computational history project. The findings are exploratory and have not been peer reviewed.</p>
        </div>
        <div>
          <p className="text-cream font-semibold mb-2">Built from</p>
          <ul className="space-y-1.5">
            <li>Atack, historical railroad GIS, 1826–1911</li>
            <li>U.S. Census volumes 1910–1970, 2010 and 2020 counts, TIGER/Line</li>
            <li>USGS Geographic Names Information System</li>
          </ul>
        </div>
        <div>
          <p className="text-cream font-semibold mb-2">Help improve it</p>
          <ul className="space-y-1.5">
            <li><Link className="underline underline-offset-4 hover:text-white" href="/data#corrections">Report a historical inaccuracy</Link></li>
            <li><Link className="underline underline-offset-4 hover:text-white" href="/methodology">Read the methodology</Link></li>
            <li><Link className="underline underline-offset-4 hover:text-white" href="/data">Download the research data</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
