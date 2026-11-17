import type { Metadata } from "next";
import { readJson } from "@/lib/data";
import { PageHeader, Container } from "@/components/ui";
import TownTable from "./TownTable";

export const metadata: Metadata = { title: "Towns", description: "Search the Texas towns in the RailEffect dataset by name, county, rail access and population." };

export default function Page() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = readJson<any[]>("towns_index.json");
  return (
    <>
      <PageHeader eyebrow="Town Survival Explorer" title={`${idx.length.toLocaleString()} Texas towns, located and traced through the census`}>
        Every town here was printed as an incorporated place in at least one digitized census table (1910–1970), has at least one population value of quality A or B, and was matched by name within its county to a USGS or Census gazetteer point.
      </PageHeader>
      <Container className="py-8"><TownTable rows={idx} /></Container>
    </>
  );
}
