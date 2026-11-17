"use client";
import dynamic from "next/dynamic";
const RailMap = dynamic(() => import("./RailMap"), { ssr: false, loading: () => <div className="h-72 bg-sand" /> });
export default function TownMap({ lat, lon, id, name }: { lat: number; lon: number; id: string; name: string }) {
  return <RailMap year={1911} towns={[{ id, name, county: "", lat, lon, firstServed: null }]} selectedTownId={id} focus={{ lat, lon, zoom: 9 }} height="300px" showModern />;
}
