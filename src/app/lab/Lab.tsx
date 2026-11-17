"use client";
import { useState } from "react";
import { Chart, COLORS } from "@/components/Chart";
import { Card, KindTag, fmt } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TERM: Record<string, string> = {
  served1911: "Track ≤ 2 km by 1911", served2020: "Track ≤ 2 km in 2020", ln_dist_int: "ln(1 + km to Interstate)", ln_pop1940: "ln 1940 population",
  ln_hub: "ln(1 + network km to 1910 hub)", junction1911: "Mapped junction (degree ≥ 3)", betweenness_1911: "Betweenness 1911",
  x: "Longitude (centred)", y: "Latitude (centred)", "I(x ** 2)": "Longitude²", "I(y ** 2)": "Latitude²", "x:y": "Longitude × latitude",
  ln_pop_base: "ln baseline population",
};
const t = (k: string) => TERM[k] || k;

function Forest({ rows, label }: { rows: { name: string; coef: number; lo: number; hi: number }[]; label: string }) {
  return <Chart label={label} height={Math.max(180, 46 * rows.length + 70)} data={[{
    type: "scatter", mode: "markers", x: rows.map((r) => r.coef), y: rows.map((r) => r.name),
    error_x: { type: "data", symmetric: false, array: rows.map((r) => r.hi - r.coef), arrayminus: rows.map((r) => r.coef - r.lo), color: COLORS.ink, thickness: 1.5 },
    marker: { color: COLORS.served, size: 10 }, hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
  }]} layout={{ margin: { l: 230, r: 20, t: 10, b: 40 }, xaxis: { title: { text: "Coefficient (95% CI, HC3)" }, zeroline: true, zerolinewidth: 2 }, yaxis: { automargin: true }, showlegend: false }} />;
}

export default function Lab({ m }: { m: any }) {
  const [tab, setTab] = useState<"A" | "B" | "C" | "R">("A");
  const [outcome, setOutcome] = useState<"g40_20" | "g40_60">("g40_20");
  const [group, setGroup] = useState<"by_served1911" | "by_era">("by_served1911");
  const [model, setModel] = useState(0);
  const A = m.model_a, B = m.model_b, C = m.model_c;
  const desc = A.outcomes[outcome][group] as any[];
  const gname = (g: string) => (group === "by_served1911" ? (g === "1" ? "Track ≤ 2 km by 1911" : "No track ≤ 2 km by 1911") : g);
  const mb = B.models[model];
  return (
    <div>
      <div role="tablist" aria-label="Models" className="flex flex-wrap gap-2 mb-6">
        {([["A", "Model A · Descriptive"], ["B", "Model B · Regression"], ["C", "Model C · Panel & matching"], ["R", "Robustness"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-md text-sm border ${tab === k ? "bg-coal text-cream border-coal" : "bg-white border-rule"}`}>{l}</button>
        ))}
      </div>

      {tab === "A" && (
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2" kicker="Model A" title={A.title}>
            <div className="flex flex-wrap gap-3 mb-3 text-sm">
              <label>Outcome <select value={outcome} onChange={(e) => setOutcome(e.target.value as any)} className="border border-rule rounded px-2 py-1 bg-white"><option value="g40_20">ln(pop 2020 / pop 1940)</option><option value="g40_60">ln(pop 1960 / pop 1940)</option></select></label>
              <label>Group by <select value={group} onChange={(e) => setGroup(e.target.value as any)} className="border border-rule rounded px-2 py-1 bg-white"><option value="by_served1911">Rail access by 1911</option><option value="by_era">Benchmark of first track</option></select></label>
            </div>
            <Chart label="Mean growth by group with bootstrap 95% CI" height={300} data={[{
              type: "bar", x: desc.map((d) => gname(d.group)), y: desc.map((d) => d.mean),
              error_y: { type: "data", symmetric: false, array: desc.map((d) => d.mean_ci[1] - d.mean), arrayminus: desc.map((d) => d.mean - d.mean_ci[0]), color: COLORS.ink },
              marker: { color: desc.map((d) => (d.group === "0" || d.group.startsWith("not") ? COLORS.notServed : COLORS.served)) }, hovertemplate: "%{x}: %{y:.3f}<extra></extra>",
            }]} layout={{ yaxis: { title: { text: "Mean log growth" } }, showlegend: false }} />
            <table className="w-full text-sm mt-3" data-testid="model-a-table">
              <thead><tr className="text-left border-b border-rule"><th className="py-1">Group</th><th>n</th><th>Mean (95% CI)</th><th>Median (95% CI)</th><th>Share declined</th></tr></thead>
              <tbody>{desc.map((d) => (
                <tr key={d.group} className="border-b border-rule/60"><td className="py-1">{gname(d.group)}</td><td className="num">{d.n}</td>
                  <td className="num">{d.mean.toFixed(3)} ({d.mean_ci[0]?.toFixed(3)}, {d.mean_ci[1]?.toFixed(3)})</td>
                  <td className="num">{d.median.toFixed(3)} ({d.median_ci[0]?.toFixed(3)}, {d.median_ci[1]?.toFixed(3)})</td>
                  <td className="num">{(d.share_declined * 100).toFixed(0)}%</td></tr>))}</tbody>
            </table>
          </Card>
          <Card kicker="Reading this" title="What Model A can and cannot say">
            <KindTag kind="Computed result" />
            <p className="text-sm mt-2">Towns with track within 2 km by 1911 grew by <span className="num">{A.diff_mean_g40_20.served_minus_not.toFixed(2)}</span> more log points on average between 1940 and 2020 than towns without (95% CI <span className="num">{A.diff_mean_g40_20.ci[0].toFixed(2)}</span> to <span className="num">{A.diff_mean_g40_20.ci[1].toFixed(2)}</span>; n = {A.diff_mean_g40_20.n_served} vs {A.diff_mean_g40_20.n_not}).</p>
            <KindTag kind="Uncertain inference" />
            <p className="text-sm mt-2">The comparison is unadjusted. Unserved towns are concentrated in the west and were smaller, so this gap mixes geography and size with rail access (see Model B).</p>
            <p className="text-sm mt-3 text-muted">Persistence as a 2020 census place: {A.persistence.map((p: any) => `${p.group ? "served" : "not served"} ${(p.persisted_2020_share * 100).toFixed(1)}% (n=${p.n})`).join("; ")}. Because the sample consists of towns that had already incorporated, near-universal persistence is expected and uninformative about vanished settlements.</p>
          </Card>
        </div>
      )}

      {tab === "B" && (
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2" kicker="Model B" title="Multivariate regression">
            <label className="text-sm">Specification <select data-testid="model-select" value={model} onChange={(e) => setModel(Number(e.target.value))} className="ml-1 border border-rule rounded px-2 py-1 bg-white max-w-full">
              {B.models.map((x: any, i: number) => <option key={i} value={i}>{x.label}</option>)}</select></label>
            <p className="text-xs text-muted mt-2 num break-words">{mb.formula}</p>
            <Forest label={`Coefficient plot: ${mb.label}`} rows={mb.terms.filter((r: any) => !["x", "y", "I(x ** 2)", "I(y ** 2)", "x:y"].includes(r.term)).map((r: any) => ({ name: t(r.term), coef: r.coef, lo: r.ci_low, hi: r.ci_high }))} />
            <table className="w-full text-sm mt-2" data-testid="model-b-table">
              <thead><tr className="text-left border-b border-rule"><th className="py-1">Term</th><th>Coef.</th><th>95% CI (HC3)</th><th>p (HC3)</th><th>p (county-clustered)</th></tr></thead>
              <tbody>{mb.terms.map((r: any) => (
                <tr key={r.term} className="border-b border-rule/60"><td className="py-1">{t(r.term)}</td><td className="num">{r.coef.toFixed(3)}</td><td className="num">[{r.ci_low.toFixed(3)}, {r.ci_high.toFixed(3)}]</td><td className="num">{r.p_hc3.toFixed(3)}</td><td className="num">{r.p_cluster?.toFixed(3) ?? "—"}</td></tr>))}</tbody>
            </table>
            <p className="text-sm mt-3"><span className="num">n = {mb.n}</span> · R² = <span className="num">{mb.r2}</span> · adj. R² = <span className="num">{mb.adj_r2}</span></p>
          </Card>
          <div className="space-y-5">
            <Card kicker="Diagnostics" title="Model checks">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
                <dt className="text-muted">Breusch–Pagan p (heteroskedasticity)</dt><dd className="num">{mb.diagnostics.breusch_pagan_p}</dd>
                <dt className="text-muted">Jarque–Bera p (normality)</dt><dd className="num">{mb.diagnostics.jarque_bera_p}</dd>
                <dt className="text-muted">Max Cook’s distance</dt><dd className="num">{mb.diagnostics.max_cooks_distance}</dd>
                <dt className="text-muted">Obs. with Cook’s D &gt; 4/n</dt><dd className="num">{mb.diagnostics.n_cooks_gt_4_over_n}</dd>
                <dt className="text-muted">Residual s.d.</dt><dd className="num">{mb.diagnostics.residual_sd}</dd>
              </dl>
              <p className="text-xs text-muted mt-2">Heteroskedasticity and non-normal residuals are why HC3 and county-clustered errors are reported. VIFs: {Object.entries(mb.diagnostics.vif).map(([k, v]) => `${t(k)} ${v}`).join("; ")}.</p>
            </Card>
            <Card kicker="Persistence" title={B.logit.label}>
              <table className="w-full text-sm"><tbody>{B.logit.terms.map((r: any) => <tr key={r.term} className="border-b border-rule/60"><td className="py-1">{t(r.term)}</td><td className="num">{r.coef.toFixed(3)}</td><td className="num">[{r.ci_low.toFixed(2)}, {r.ci_high.toFixed(2)}]</td><td className="num">AME {r.avg_marginal_effect?.toFixed(3)}</td></tr>)}</tbody></table>
              <p className="text-xs text-muted mt-2">n = {B.logit.n}; pseudo-R² {B.logit.pseudo_r2}.</p>
            </Card>
            <Card kicker="Caution" title="Interpretation"><p className="text-sm">{B.notes}</p></Card>
          </div>
        </div>
      )}

      {tab === "C" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card kicker="Model C1" title="Two-way fixed effects, 1890–1910">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm" data-testid="panel-stats">
              <dt className="text-muted">Towns / town-years</dt><dd className="num">{C.panel_1890_1910.n_towns} / {C.panel_1890_1910.n_obs}</dd>
              <dt className="text-muted">Towns whose rail status changes within the panel</dt><dd className="num">{C.panel_1890_1910.n_switchers}</dd>
              <dt className="text-muted">Always served / never served</dt><dd className="num">{C.panel_1890_1910.always_treated} / {C.panel_1890_1910.never_treated}</dd>
              {C.panel_1890_1910.coef_rail != null && <><dt className="text-muted">Rail coefficient (log points)</dt><dd className="num">{C.panel_1890_1910.coef_rail} [{C.panel_1890_1910.ci[0]}, {C.panel_1890_1910.ci[1]}]</dd></>}
            </dl>
            <KindTag kind="Uncertain inference" />
            <p className="text-sm mt-2">{C.panel_1890_1910.assessment}</p>
            <p className="text-sm mt-2 font-medium">With only {C.panel_1890_1910.n_switchers} towns changing status, this design cannot support an event-study interpretation. It is shown for transparency.</p>
          </Card>
          <Card kicker="Model C2" title="Matched comparison (Mahalanobis nearest neighbour)">
            {[C.matched_g40_20, C.matched_g40_60].filter(Boolean).map((r: any) => (
              <div key={r.outcome} className="mb-4">
                <p className="text-sm font-medium">{r.outcome === "g40_20" ? "Growth 1940–2020" : "Growth 1940–1960"}</p>
                <p className="num text-2xl">{r.att.toFixed(3)} <span className="text-base text-muted">[{r.ci[0]}, {r.ci[1]}]</span></p>
                <p className="text-xs text-muted">{r.n_treated} served towns matched to {r.n_control_pool} candidate controls. {r.method}.</p>
                <table className="text-xs mt-1"><tbody>{Object.entries(r.balance).map(([k, v]: any) => <tr key={k}><td className="pr-3 text-muted">{t(k)}</td><td className="num pr-3">treated {v.treated_mean}</td><td className="num">pool {v.control_pool_mean}</td></tr>)}</tbody></table>
              </div>
            ))}
            <KindTag kind="Uncertain inference" />
            <p className="text-sm mt-2">The control pool is small and geographically different (unserved towns are mostly western). Matching with replacement re-uses a few controls, and the CI ignores matching uncertainty, so it is narrower than it should be.</p>
          </Card>
        </div>
      )}

      {tab === "R" && (
        <Card kicker="Robustness" title="Does the rail coefficient survive alternative choices?">
          <Forest label="Robustness of the rail-access coefficient" rows={m.robustness.filter((r: any) => r.coef != null).map((r: any) => ({ name: `${r.check} (n=${r.n})`, coef: r.coef, lo: r.ci_low, hi: r.ci_high }))} />
          <p className="text-sm mt-3">{(() => { const rr = m.robustness.filter((r: any) => r.coef != null); const inc = rr.filter((r: any) => r.ci_low <= 0 && r.ci_high >= 0).length; const neg = rr.filter((r: any) => r.coef < 0).length; return <>In {inc} of {rr.length} alternative specifications the 95% interval includes zero; {neg} of {rr.length} point estimates are negative.</>; })()} Missing-data check: {fmt(m.missing_data.with_A1940)} of {fmt(m.missing_data.towns_total)} towns have a verified 1940 count; {(m.missing_data.served1911_share_with * 100).toFixed(0)}% of them were rail-served by 1911 versus {(m.missing_data.served1911_share_without * 100).toFixed(0)}% of towns without one, so the regression sample over-represents rail towns.</p>
        </Card>
      )}
    </div>
  );
}
