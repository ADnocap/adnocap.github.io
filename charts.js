/* charts.js — tiny SVG chart renderer for this site. No dependencies.
   A chart is a <div class="chart" data-chart="bars|line|hbars|dots|pnl"> that references a
   <script type="application/json"> block by id (data-src). Every chart also gets a
   table twin inside <details class="data"> so no value is reachable only by hover.
   Formatters can be given by name in JSON: "int", "compact", "money", "pct1", "num". */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (n, a, t) => { const e = document.createElementNS(NS, n); for (const k in a || {}) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; };
  const strip = t => t.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const fmt = v => (Number.isInteger(+v.toFixed(6)) ? Math.round(v).toLocaleString("en-US") : Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : Math.abs(v) >= 10 ? strip(v.toFixed(1)) : Math.abs(v) >= 1 ? strip(v.toFixed(2)) : strip(v.toFixed(3)));
  const money = v => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const F = {
    num: fmt,
    int: v => Math.round(v).toLocaleString("en-US"),
    compact: v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + "k" : String(Math.round(v)),
    money,
    pct1: v => v.toFixed(1) + "%",
  };
  const res = f => (typeof f === "string" ? (F[f] || fmt) : typeof f === "function" ? f : null);
  const niceTicks = (lo, hi, n) => {
    const span = hi - lo || 1, raw = span / (n || 5), p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p, step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
    const out = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10)); return out;
  };

  function table(host, head, rows) {
    const d = document.createElement("details"); d.className = "data";
    const s = document.createElement("summary"); s.textContent = "Data table"; d.appendChild(s);
    const t = document.createElement("table"); t.className = "tbl";
    const tr = document.createElement("tr"); head.forEach((h, i) => { const th = document.createElement("th"); th.textContent = h; if (i) th.className = "n"; tr.appendChild(th); }); t.appendChild(tr);
    rows.forEach(r => { const tr2 = document.createElement("tr"); r.forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (i) td.className = "n"; tr2.appendChild(td); }); t.appendChild(tr2); });
    d.appendChild(t); host.appendChild(d);
  }
  function tip(host) { const t = document.createElement("div"); t.className = "tip"; host.appendChild(t); return t; }
  function showTip(t, host, x, y, html) {
    t.innerHTML = html; const svg = host.querySelector("svg"); const r = host.getBoundingClientRect(); const s = svg.getBoundingClientRect();
    t.style.left = (s.left - r.left + x * s.width / +svg.getAttribute("width")) + "px";
    t.style.top = (s.top - r.top + y * s.height / +svg.getAttribute("height")) + "px";
    t.classList.add("on");
  }
  function hideTip(t) { t.classList.remove("on"); }

  /* ----- vertical bars ----- */
  function bars(host, d) {
    const W = d.width || 700, m = { t: 22, r: 12, b: 42, l: 50 };
    const vf = res(d.valfmt) || fmt, tf = res(d.tickfmt) || fmt, unit = d.unit || "";
    const n = d.values.length, iw = W - m.l - m.r;
    const maxLen = Math.max(...d.categories.map(c => String(c).length)), rotate = maxLen * 7.2 > iw / n - 4;
    if (rotate) m.b = 42 + Math.min(60, maxLen * 4);
    const H = (d.height || 300) + (m.b - 42), ih = H - m.t - m.b;
    let lo = Math.min(0, ...d.values), hi = Math.max(0, ...d.values);
    if (d.ymin != null) lo = d.ymin; if (d.ymax != null) hi = d.ymax; if (hi === lo) hi = lo + 1;
    const ticks = niceTicks(lo, hi, 5); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    const y = v => m.t + ih - (v - lo) / (hi - lo) * ih, band = iw / n, bw = Math.min(24, band * 0.62);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ticks.forEach(v => g.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }))); svg.appendChild(g);
    ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, tf(v))));
    if (lo < 0 && hi > 0) svg.appendChild(el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
    if (d.baseline != null) { svg.appendChild(el("line", { class: "marker", x1: m.l, x2: W - m.r, y1: y(d.baseline), y2: y(d.baseline) })); svg.appendChild(el("text", { class: "label", x: W - m.r, y: y(d.baseline) - 5, "text-anchor": "end" }, d.baselineLabel || "")); }
    const t = tip(host);
    d.values.forEach((v, i) => {
      const cx = m.l + band * (i + 0.5), top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
      const cls = (d.classes && d.classes[i]) || (v < 0 ? "loss" : (d.highlight && d.highlight.indexOf(i) >= 0) ? "series-1" : (d.highlight ? "neutral" : "series-1"));
      svg.appendChild(el("rect", { class: cls, x: cx - bw / 2, y: top, width: bw, height: Math.max(h, 0.5), rx: 2 }));
      const hit = el("rect", { class: "hit", x: cx - band / 2, y: m.t, width: band, height: ih });
      hit.addEventListener("mouseenter", () => showTip(t, host, cx, top, `${d.categories[i]}: <b>${vf(v)}${unit}</b>`));
      hit.addEventListener("mouseleave", () => hideTip(t));
      svg.appendChild(hit);
      if (d.showValues || (d.labelIdx && d.labelIdx.indexOf(i) >= 0)) svg.appendChild(el("text", { class: "label", x: cx, y: (v >= 0 ? top - 5 : y(0) - 5), "text-anchor": "middle" }, vf(v) + unit));
      const lbl = el("text", { class: "tick", x: cx, y: H - m.b + 16, "text-anchor": "middle" }, d.categories[i]);
      if (rotate) { lbl.setAttribute("transform", `rotate(-40 ${cx} ${H - m.b + 16})`); lbl.setAttribute("text-anchor", "end"); }
      svg.appendChild(lbl);
    });
    if (d.ylabel) svg.appendChild(el("text", { class: "label", x: m.l, y: 12 }, d.ylabel));
    host.appendChild(svg);
    table(host, [d.xhead || "Category", d.yhead || (d.ylabel || "Value")], d.categories.map((c, i) => [c, vf(d.values[i]) + unit]));
  }

  /* ----- horizontal bars ----- */
  function hbars(host, d) {
    const W = d.width || 700, n = d.values.length, rowH = 26, m = { t: 8, r: 64, b: 26, l: d.labelWidth || 150 }, H = m.t + m.b + n * rowH;
    const vf = res(d.valfmt) || fmt, unit = d.unit || "";
    const iw = W - m.l - m.r; let lo = Math.min(0, ...d.values), hi = Math.max(0, ...d.values); if (hi === lo) hi = lo + 1;
    const ticks = niceTicks(lo, hi, 4); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    const x = v => m.l + (v - lo) / (hi - lo) * iw;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ticks.forEach(v => g.appendChild(el("line", { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }))); svg.appendChild(g);
    ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: x(v), y: H - m.b + 16, "text-anchor": "middle" }, fmt(v) + unit)));
    if (lo < 0 && hi > 0) svg.appendChild(el("line", { class: "zero", x1: x(0), x2: x(0), y1: m.t, y2: H - m.b }));
    d.values.forEach((v, i) => {
      const cy = m.t + rowH * (i + 0.5), hl = d.highlight && d.highlight.indexOf(i) >= 0;
      const cls = (d.classes && d.classes[i]) || (v < 0 ? "loss" : hl ? "series-1" : (d.highlight ? "neutral" : "series-1"));
      svg.appendChild(el("rect", { class: cls, x: Math.min(x(v), x(0)), y: cy - 8, width: Math.max(Math.abs(x(v) - x(0)), 0.5), height: 16, rx: 2 }));
      svg.appendChild(el("text", { class: "label" + (hl ? " strong" : ""), x: m.l - 10, y: cy + 4, "text-anchor": "end" }, d.categories[i]));
      svg.appendChild(el("text", { class: "label", x: (v >= 0 ? x(v) + 6 : x(0) + 6), y: cy + 4, "text-anchor": "start" }, vf(v) + unit));
    });
    host.appendChild(svg);
    table(host, [d.xhead || "Item", d.yhead || "Value"], d.categories.map((c, i) => [c, vf(d.values[i]) + unit]));
  }

  /* ----- line(s) ----- */
  function line(host, d) {
    const W = d.width || 700, H = d.height || 300, m = { t: 22, r: 16, b: 40, l: 58 };
    const vf = res(d.valfmt) || fmt, tf = res(d.tickfmt) || fmt, unit = d.unit || "";
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = d.x.length;
    const all = d.series.flatMap(s => s.values.filter(v => v != null));
    let lo = Math.min(...all), hi = Math.max(...all); if (d.ymin != null) lo = d.ymin; if (d.ymax != null) hi = d.ymax; if (d.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (hi === lo) { hi = lo + 1; }
    const ticks = niceTicks(lo, hi, 5); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    const x = i => m.l + (n > 1 ? i / (n - 1) : 0.5) * iw, y = v => m.t + ih - (v - lo) / (hi - lo) * ih;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ticks.forEach(v => g.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }))); svg.appendChild(g);
    ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, tf(v))));
    if (lo < 0 && hi > 0) svg.appendChild(el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
    const step = Math.max(1, Math.ceil(n / (d.xticks || 8)));
    d.x.forEach((lab, i) => { if (i % step === 0 || i === n - 1) svg.appendChild(el("text", { class: "tick", x: x(i), y: H - m.b + 18, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, lab)); });
    (d.markers || []).forEach((mk, k) => { svg.appendChild(el("line", { class: "marker", x1: x(mk.x), x2: x(mk.x), y1: m.t, y2: m.t + ih })); svg.appendChild(el("text", { class: "label", x: x(mk.x) + 5, y: m.t + 12 + (k % 3) * 14 }, mk.label)); });
    d.series.forEach((s, si) => {
      const cls = s.cls || (si === 0 ? "series-1" : si === 1 ? "series-2" : "neutral");
      let dstr = "", started = false;
      s.values.forEach((v, i) => { if (v == null) { started = false; return; } dstr += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); started = true; });
      if (d.area && si === 0) { const first = s.values.findIndex(v => v != null), last = n - 1 - [...s.values].reverse().findIndex(v => v != null); svg.appendChild(el("path", { class: "area " + cls, d: dstr + `L${x(last).toFixed(1)} ${y(Math.max(lo, 0)).toFixed(1)}L${x(first).toFixed(1)} ${y(Math.max(lo, 0)).toFixed(1)}Z` })); }
      const p = el("path", { class: "line " + cls + " draw", d: dstr }); svg.appendChild(p);
      try { const L = p.getTotalLength(); p.style.setProperty("--len", L); } catch (e) { p.classList.remove("draw"); }
      if (d.dots) s.values.forEach((v, i) => { if (v != null) svg.appendChild(el("circle", { class: "dot " + cls, cx: x(i), cy: y(v), r: 4 })); });
      if (d.endLabels === true && d.series.length > 1) { const li = n - 1 - [...s.values].reverse().findIndex(v => v != null); svg.appendChild(el("text", { class: "label", x: x(li) - 6, y: y(s.values[li]) - 9, "text-anchor": "end" }, s.name)); }
    });
    if (d.ylabel) svg.appendChild(el("text", { class: "label", x: m.l, y: 12 }, d.ylabel));
    const ch = el("line", { class: "crosshair", x1: 0, x2: 0, y1: m.t, y2: m.t + ih }); svg.appendChild(ch);
    const t = tip(host);
    const hit = el("rect", { class: "hit", x: m.l, y: m.t, width: iw, height: ih }); svg.appendChild(hit);
    hit.addEventListener("mousemove", ev => {
      const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width; const i = Math.round((px - m.l) / iw * (n - 1)); if (i < 0 || i >= n) return;
      ch.setAttribute("x1", x(i)); ch.setAttribute("x2", x(i)); ch.classList.add("on");
      const rows = d.series.filter(s => s.values[i] != null).map(s => `${s.name}: <b>${vf(s.values[i])}${unit}</b>`).join("<br>");
      showTip(t, host, x(i), m.t + 4, `${d.x[i]}<br>${rows}`);
    });
    hit.addEventListener("mouseleave", () => { hideTip(t); ch.classList.remove("on"); });
    host.appendChild(svg);
    if (d.series.length > 1) {
      const lg = document.createElement("div"); lg.className = "legend";
      d.series.forEach((s, si) => { const sp = document.createElement("span"); const i = document.createElement("i"); const cls = s.cls || (si === 0 ? "series-1" : si === 1 ? "series-2" : "neutral"); i.style.background = `var(--${cls === "series-1" ? "series" : cls})`; sp.appendChild(i); sp.appendChild(document.createTextNode(s.name)); lg.appendChild(sp); });
      host.appendChild(lg);
    }
    table(host, [d.xhead || "x", ...d.series.map(s => s.name)], d.x.map((lab, i) => [lab, ...d.series.map(s => s.values[i] == null ? "" : vf(s.values[i]) + unit)]));
  }

  /* ----- paired dots ----- */
  function dots(host, d) {
    const W = d.width || 700, n = d.categories.length, rowH = 24, m = { t: 26, r: 24, b: 30, l: d.labelWidth || 110 }, H = m.t + m.b + n * rowH, iw = W - m.l - m.r;
    const unit = d.unit || "";
    let lo = Math.min(...d.before, ...d.after), hi = Math.max(...d.before, ...d.after); const ticks = niceTicks(lo - 2, hi + 2, 5); lo = Math.min(lo - 1.5, ticks[0]); hi = Math.max(hi + 1.5, ticks[ticks.length - 1]);
    const x = v => m.l + (v - lo) / (hi - lo) * iw;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ticks.forEach(v => g.appendChild(el("line", { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }))); svg.appendChild(g);
    ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: x(v), y: H - m.b + 16, "text-anchor": "middle" }, fmt(v) + unit)));
    d.categories.forEach((c, i) => {
      const cy = m.t + rowH * (i + 0.5);
      svg.appendChild(el("line", { x1: x(d.before[i]), x2: x(d.after[i]), y1: cy, y2: cy, stroke: "var(--rule)", "stroke-width": 2 }));
      svg.appendChild(el("circle", { class: "dot neutral", cx: x(d.before[i]), cy, r: 5 }));
      svg.appendChild(el("circle", { class: "dot series-1", cx: x(d.after[i]), cy, r: 5 }));
      svg.appendChild(el("text", { class: "label", x: m.l - 10, y: cy + 4, "text-anchor": "end" }, c));
    });
    svg.appendChild(el("text", { class: "label", x: m.l, y: 14 }, `grey: ${d.names[0]}   blue: ${d.names[1]}`));
    host.appendChild(svg);
    table(host, [d.xhead || "Item", d.names[0], d.names[1]], d.categories.map((c, i) => [c, fmt(d.before[i]) + unit, fmt(d.after[i]) + unit]));
  }

  /* ----- dated P&L series ----- */
  function pnl(host, d) {
    const x = d.points.map(p => p[0]), v = d.points.map(p => p[1]);
    const mk = (d.markers || []).map(mm => ({ x: Math.max(0, x.findIndex(s => s >= mm.date)), label: mm.label }));
    line(host, { x, series: [{ name: d.name || "P&L", values: v }], markers: mk, zero: true, area: true, xticks: d.xticks || 7, valfmt: "money", tickfmt: "money", ylabel: d.ylabel, width: d.width, height: d.height, xhead: "Date", label: d.label, endLabels: false });
  }

  const R = { bars, hbars, line, dots, pnl };
  function render(host) {
    const src = host.getAttribute("data-src"); const node = src && document.querySelector(src);
    if (!node) return; let d; try { d = JSON.parse(node.textContent); } catch (e) { console.error("chart json", e); return; }
    const fn = R[host.getAttribute("data-chart")]; if (fn) fn(host, d);
  }
  window.renderChart = render;
  window.renderCharts = () => document.querySelectorAll(".chart[data-src]").forEach(h => { if (!h.dataset.done) { h.dataset.done = "1"; render(h); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.renderCharts); else window.renderCharts();
})();
