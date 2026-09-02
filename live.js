/* live.js — fills charts from JSON files that are refreshed after the page was written
   (data/fpl.json by a weekly GitHub Action; data/polymarket_pnl.json is a dated snapshot). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const money = v => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const num = v => v == null ? "" : v.toLocaleString("en-US");

  function fplTracker(d) {
    const gws = d.gameweeks || [];
    $("#fpl-updated").textContent = d.updated_utc ? d.updated_utc.slice(0, 10) : "";
    $("#fpl-season").textContent = d.season || "";
    $("#fpl-team").textContent = d.team_name || "";
    $("#fpl-points").textContent = num(d.overall_points);
    $("#fpl-rank").textContent = num(d.overall_rank);
    $("#fpl-players").textContent = num(d.total_players);
    $("#fpl-gws").textContent = String(gws.length);
    const avg = gws.map(g => g.average).filter(v => v != null);
    const ahead = gws.filter(g => g.average != null && g.points > g.average).length;
    $("#fpl-vs-avg").textContent = avg.length ? `${ahead} of ${avg.length}` : "";
    const cum = gws.reduce((a, g) => a + (g.points || 0), 0), cumAvg = avg.reduce((a, v) => a + v, 0);
    $("#fpl-cum-diff").textContent = avg.length ? ((cum - cumAvg >= 0 ? "+" : "") + num(cum - cumAvg)) : "";
    // points per gameweek vs the global average
    const j1 = document.createElement("script"); j1.type = "application/json"; j1.id = "fpl-gw-json";
    j1.textContent = JSON.stringify({ x: gws.map(g => "GW" + g.gw), series: [{ name: "Claude FC", values: gws.map(g => g.points) }, { name: "Average of all managers", values: gws.map(g => g.average), cls: "neutral" }], ylabel: "Points per gameweek", dots: true, zero: true, xhead: "Gameweek", label: "Points per gameweek versus the average of all managers", valfmt: "int", tickfmt: "int" });
    document.body.appendChild(j1);
    const h1 = $("#fpl-gw-chart"); if (h1 && window.renderChart) { h1.setAttribute("data-src", "#fpl-gw-json"); window.renderChart(h1); }
    // overall rank over time (lower is better), shown as a line with a log-ish feel via plain values
    const j2 = document.createElement("script"); j2.type = "application/json"; j2.id = "fpl-rank-json";
    j2.textContent = JSON.stringify({ x: gws.map(g => "GW" + g.gw), series: [{ name: "Overall rank", values: gws.map(g => g.rank) }], ylabel: "Overall rank after each gameweek (lower is better)", dots: true, xhead: "Gameweek", label: "Overall rank after each gameweek", valfmt: "int", tickfmt: "compact", ymin: 0 });
    document.body.appendChild(j2);
    const h2 = $("#fpl-rank-chart"); if (h2 && window.renderChart) { h2.setAttribute("data-src", "#fpl-rank-json"); window.renderChart(h2); }
    // table
    const tb = $("#fpl-table tbody"); if (tb) { tb.innerHTML = ""; gws.forEach(g => { const tr = document.createElement("tr"); tr.innerHTML = `<td>GW${g.gw}</td><td class="n">${g.points}</td><td class="n">${g.average == null ? "" : g.average}</td><td class="n">${g.total}</td><td class="n">${num(g.rank)}</td><td class="n">${g.transfers}${g.hit ? " (−" + g.hit + ")" : ""}</td><td>${g.chip || ""}</td>`; tb.appendChild(tr); }); }
  }

  function polymarketPnl(d) {
    const pts = d.map(p => [new Date(p.t * 1000).toISOString().slice(0, 10), Math.round(p.p * 100) / 100]);
    const j = document.createElement("script"); j.type = "application/json"; j.id = "pm-pnl-json";
    j.textContent = JSON.stringify({ points: pts, name: "Wallet P&L", ylabel: "Cumulative P&L reported by Polymarket, USD", markers: [{ date: "2026-01-23", label: "executor live" }, { date: "2026-03-28", label: "hub/worker live" }, { date: "2026-04-09", label: "S5 live" }, { date: "2026-06-15", label: "V2 pilots" }], xticks: 6, height: 320, width: 960, label: "Polymarket wallet P&L over time" });
    document.body.appendChild(j);
    const h = $("#pm-pnl-chart"); if (h && window.renderChart) { h.setAttribute("data-src", "#pm-pnl-json"); window.renderChart(h); }
    const last = pts[pts.length - 1], mx = pts.reduce((a, p) => p[1] > a[1] ? p : a), mn = pts.reduce((a, p) => p[1] < a[1] ? p : a);
    const s = $("#pm-pnl-summary"); if (s) s.textContent = `Peak ${money(mx[1])} on ${mx[0]}, trough ${money(mn[1])} on ${mn[0]}, ${money(last[1])} on ${last[0]} (last point in the snapshot).`;
  }

  function go() {
    const jobs = [];
    if ($("#fpl-gw-chart")) jobs.push(fetch("../../data/fpl.json").then(r => r.json()).then(fplTracker).catch(e => { const n = $("#fpl-error"); if (n) n.hidden = false; console.error(e); }));
    if ($("#pm-pnl-chart")) jobs.push(fetch("../../data/polymarket_pnl.json").then(r => r.json()).then(polymarketPnl).catch(e => console.error(e)));
    return Promise.all(jobs);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
