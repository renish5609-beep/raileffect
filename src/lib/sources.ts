// Map a source-table id + PDF page to a citation link (PDF page anchors work in standard browser viewers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function citation(sources: any, table: string, page?: number | null): { title: string; url: string } | null {
  const t = sources?.census_tables?.[table];
  if (!t) return null;
  return { title: t.title, url: page ? `${t.url}#page=${page}` : t.url };
}
