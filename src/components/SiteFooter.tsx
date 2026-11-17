import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-coal text-cream/70 text-sm mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <p className="serif text-cream text-lg mb-2">RailEffect</p>
          <p>An open-source computational history project. Findings are exploratory and have not been peer reviewed.</p>
        </div>
        <div>
          <p className="text-cream mb-2 font-medium">Principal sources</p>
          <ul className="space-y-1">
            <li>Atack, J. — Historical GIS database of U.S. railroads, 1826–1911 (May 2016)</li>
            <li>U.S. Census Bureau — decennial census volumes 1910–1970; 2010 & 2020 counts; TIGER/Line</li>
            <li>USGS Geographic Names Information System</li>
          </ul>
        </div>
        <div>
          <p className="text-cream mb-2 font-medium">Contribute</p>
          <ul className="space-y-1">
            <li><Link className="underline" href="/data#corrections">Report a historical inaccuracy</Link></li>
            <li><Link className="underline" href="/methodology">Read the methodology</Link></li>
            <li><Link className="underline" href="/data">Download research data</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
