/* charts.js — tiny SVG chart renderer for this site. No dependencies.
   A chart is a <div class="chart" data-chart="bars|line|hbars|dots|pnl"> that references a
   <script type="application/json"> block by id (data-src). Charts render at the width of their
   container (so text stays 12px on phones) and re-render on resize. Every chart also gets a
   table twin (details.data) after its caption, so no value is reachable only by hover.
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
  const decOf = step => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const fixed = (dec) => v => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(dec));
  /* axis: snap to whole steps so data never sits beyond the outer gridline */
  function axis(lo, hi, n) {
    if (hi === lo) hi = lo + 1;
    const raw = (hi - lo) / (n || 5), p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p, step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
    lo = Math.floor(lo / step + 1e-9) * step; hi = Math.ceil(hi / step - 1e-9) * step;
    const ticks = []; for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
    return { lo, hi, step, ticks, dec: decOf(step) };
  }
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function table(host, head, rows) {
    const d = document.createElement("details"); d.className = "data";
    const s = document.createElement("summary"); s.textContent = "Data table"; d.appendChild(s);
    const t = document.createElement("table"); t.className = "tbl";
    const tr = document.createElement("tr"); head.forEach((h, i) => { const th = document.createElement("th"); th.textContent = h; if (i) th.className = "n"; tr.appendChild(th); }); t.appendChild(tr);
    rows.forEach(r => { const tr2 = document.createElement("tr"); r.forEach((c, i) => { const td = document.createElement("td"); td.textContent = c; if (i) td.className = "n"; tr2.appendChild(td); }); t.appendChild(tr2); });
    d.appendChild(t);
    const fig = host.closest("figure"); (fig || host).appendChild(d);
  }
  function legend(host, items) {
    const lg = document.createElement("div"); lg.className = "legend";
    items.forEach(it => { const sp = document.createElement("span"); const i = document.createElement("i"); i.className = it.shape || ""; i.style.background = `var(--${it.cls === "series-1" ? "series" : it.cls})`; sp.appendChild(i); sp.appendChild(document.createTextNode(it.name)); lg.appendChild(sp); });
    host.appendChild(lg);
  }
  function tip(host) { const t = document.createElement("div"); t.className = "tip"; host.appendChild(t); return t; }
  function showTip(t, host, x, y, html) {
    t.innerHTML = html; const svg = host.querySelector("svg"); const r = host.getBoundingClientRect(); const s = svg.getBoundingClientRect();
    t.style.left = (s.left - r.left + x * s.width / +svg.getAttribute("width")) + "px";
    t.style.top = (s.top - r.top + y * s.height / +svg.getAttribute("height")) + "px";
    t.classList.add("on");
  }
  function hideTip(t) { t.classList.remove("on"); }
  const negClass = d => d.negClass || (d.valfmt === "money" ? "loss" : "neutral");

  /* ----- vertical bars ----- */
  function bars(host, d) {
    const W = d.width, m = { t: 22, r: 12, b: 42, l: 54 };
    const vf = res(d.valfmt), unit = d.unit || "";
    const n = d.values.length, iw = W - m.l - m.r;
    const maxLen = Math.max(...d.categories.map(c => String(c).length)), rotate = maxLen * 7.2 > iw / n - 4;
    if (rotate) m.b = 42 + Math.min(60, maxLen * 4);
    const H = (d.height || 300) * (W < 480 ? 0.85 : 1) + (m.b - 42), ih = H - m.t - m.b;
    let lo = Math.min(0, ...d.values), hi = Math.max(0, ...d.values);
    if (d.ymin != null) lo = d.ymin; if (d.ymax != null) hi = d.ymax;
    const ax = axis(lo, hi, 5); lo = ax.lo; hi = ax.hi;
    const tf = res(d.tickfmt) || fixed(ax.dec), lf = vf || fixed(d.decimals != null ? d.decimals : Math.min(3, ax.dec + 1));
    const y = v => m.t + ih - (v - lo) / (hi - lo) * ih, band = iw / n, bw = Math.min(24, band * 0.62);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ax.ticks.forEach(v => g.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }))); svg.appendChild(g);
    ax.ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, tf(v))));
    if (lo < 0 && hi > 0) svg.appendChild(el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
    const t = tip(host);
    d.values.forEach((v, i) => {
      const cx = m.l + band * (i + 0.5), top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
      const cls = (d.classes && d.classes[i]) || (v < 0 ? negClass(d) : (d.highlight && d.highlight.indexOf(i) >= 0) ? "series-1" : (d.highlight ? "neutral" : "series-1"));
      svg.appendChild(el("rect", { class: cls, x: cx - bw / 2, y: top, width: bw, height: Math.max(h, 0.5), rx: 2 }));
      const hit = el("rect", { class: "hit", x: cx - band / 2, y: m.t, width: band, height: ih });
      hit.addEventListener("mouseenter", () => showTip(t, host, cx, top, `${d.categories[i]}: <b>${lf(v)}${unit}</b>`));
      hit.addEventListener("mouseleave", () => hideTip(t));
      svg.appendChild(hit);
      if (d.showValues || (d.labelIdx && d.labelIdx.indexOf(i) >= 0)) svg.appendChild(el("text", { class: "label", x: cx, y: (v >= 0 ? top - 5 : top + h + 13), "text-anchor": "middle" }, lf(v) + unit));
      const lbl = el("text", { class: "tick", x: cx, y: H - m.b + 16, "text-anchor": "middle" }, d.categories[i]);
      if (rotate) { lbl.setAttribute("transform", `rotate(-40 ${cx} ${H - m.b + 16})`); lbl.setAttribute("text-anchor", "end"); }
      svg.appendChild(lbl);
    });
    if (d.baseline != null) { svg.appendChild(el("line", { class: "marker", x1: m.l, x2: W - m.r, y1: y(d.baseline), y2: y(d.baseline) })); svg.appendChild(el("text", { class: "label halo", x: W - m.r, y: y(d.baseline) - 5, "text-anchor": "end" }, d.baselineLabel || "")); }
    if (d.ylabel) svg.appendChild(el("text", { class: "label", x: m.l, y: 12 }, d.ylabel));
    host.appendChild(svg);
    table(host, [d.xhead || "Category", d.yhead || (d.ylabel || "Value")], d.categories.map((c, i) => [c, lf(d.values[i]) + unit]));
  }

  /* ----- horizontal bars ----- */
  function hbars(host, d) {
    const W = d.width, n = d.values.length, rowH = 26, m = { t: 8, r: 64, b: 26, l: Math.min(d.labelWidth || 150, Math.round(W * 0.38)) }, H = m.t + m.b + n * rowH;
    const vf = res(d.valfmt), unit = d.unit || "";
    const iw = W - m.l - m.r; let lo = Math.min(0, ...d.values), hi = Math.max(0, ...d.values);
    const ax = axis(lo, hi, 4); lo = ax.lo; hi = ax.hi;
    const tf = fixed(ax.dec), lf = vf || fixed(d.decimals != null ? d.decimals : Math.min(3, ax.dec + 1));
    const x = v => m.l + (v - lo) / (hi - lo) * iw;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ax.ticks.forEach(v => g.appendChild(el("line", { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }))); svg.appendChild(g);
    ax.ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: x(v), y: H - m.b + 16, "text-anchor": "middle" }, tf(v) + unit)));
    if (lo < 0 && hi > 0) svg.appendChild(el("line", { class: "zero", x1: x(0), x2: x(0), y1: m.t, y2: H - m.b }));
    d.values.forEach((v, i) => {
      const cy = m.t + rowH * (i + 0.5), hl = d.highlight && d.highlight.indexOf(i) >= 0;
      const cls = (d.classes && d.classes[i]) || (v < 0 ? negClass(d) : hl ? "series-1" : (d.highlight ? "neutral" : "series-1"));
      svg.appendChild(el("rect", { class: cls, x: Math.min(x(v), x(0)), y: cy - 8, width: Math.max(Math.abs(x(v) - x(0)), 0.5), height: 16, rx: 2 }));
      svg.appendChild(el("text", { class: "label" + (hl ? " strong" : ""), x: m.l - 10, y: cy + 4, "text-anchor": "end" }, d.categories[i]));
      svg.appendChild(el("text", { class: "label", x: (v >= 0 ? x(v) + 6 : x(0) + 6), y: cy + 4, "text-anchor": "start" }, lf(v) + unit));
    });
    host.appendChild(svg);
    table(host, [d.xhead || "Item", d.yhead || "Value"], d.categories.map((c, i) => [c, lf(d.values[i]) + unit]));
  }

  /* ----- line(s) ----- */
  function line(host, d) {
    const W = d.width, H = (d.height || 300) * (W < 480 ? 0.85 : 1), m = { t: 22, r: 16, b: 40, l: 60 };
    const vf = res(d.valfmt), unit = d.unit || "";
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = d.x.length;
    const all = d.series.flatMap(s => s.values.filter(v => v != null));
    let lo = Math.min(...all), hi = Math.max(...all); if (d.ymin != null) lo = d.ymin; if (d.ymax != null) hi = d.ymax; if (d.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const ax = axis(lo, hi, 5); lo = ax.lo; hi = ax.hi;
    const tf = res(d.tickfmt) || fixed(ax.dec), lf = vf || fixed(Math.min(3, ax.dec + 1));
    const x = i => m.l + (n > 1 ? i / (n - 1) : 0.5) * iw, y = v => m.t + ih - (v - lo) / (hi - lo) * ih;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ax.ticks.forEach(v => g.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }))); svg.appendChild(g);
    ax.ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, tf(v))));
    if (lo < 0 && hi > 0) svg.appendChild(el("line", { class: "zero", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }));
    /* x ticks: month boundaries for dated axes, else every k-th label */
    const want = Math.max(3, Math.floor(iw / (W < 480 ? 70 : 90)));
    if (d.dates) {
      const firsts = []; let prev = "";
      d.x.forEach((s, i) => { const ym = s.slice(0, 7); if (ym !== prev) { firsts.push(i); prev = ym; } });
      const every = Math.max(1, Math.ceil(firsts.length / want));
      firsts.forEach((i, k) => { if (k % every) return; const dt = new Date(d.x[i]); const lab = MON[dt.getUTCMonth()] + (dt.getUTCMonth() === 0 || k === 0 ? " " + String(dt.getUTCFullYear()).slice(2) : ""); svg.appendChild(el("text", { class: "tick", x: x(i), y: H - m.b + 18, "text-anchor": "middle" }, lab)); });
    } else {
      const step = Math.max(1, Math.ceil(n / want));
      d.x.forEach((lab, i) => { if (i % step === 0 || i === n - 1) svg.appendChild(el("text", { class: "tick", x: x(i), y: H - m.b + 18, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, lab)); });
    }
    (d.markers || []).forEach(mk => svg.appendChild(el("line", { class: "marker", x1: x(mk.x), x2: x(mk.x), y1: m.t, y2: m.t + ih })));
    d.series.forEach((s, si) => {
      const cls = s.cls || (si === 0 ? "series-1" : si === 1 ? "series-2" : "neutral");
      let dstr = "", started = false;
      s.values.forEach((v, i) => { if (v == null) { started = false; return; } dstr += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); started = true; });
      if (d.area && si === 0) { const first = s.values.findIndex(v => v != null), last = n - 1 - [...s.values].reverse().findIndex(v => v != null); svg.appendChild(el("path", { class: "area " + cls, d: dstr + `L${x(last).toFixed(1)} ${y(Math.max(lo, 0)).toFixed(1)}L${x(first).toFixed(1)} ${y(Math.max(lo, 0)).toFixed(1)}Z` })); }
      svg.appendChild(el("path", { class: "line " + cls, d: dstr }));
      if (d.dots) s.values.forEach((v, i) => { if (v != null) svg.appendChild(el("circle", { class: "dot " + cls, cx: x(i), cy: y(v), r: 4 })); });
    });
    /* marker labels last, with a paper halo; flip to the left of the line when crowding the previous one */
    let lastRight = -1e9;
    (d.markers || []).forEach(mk => {
      const px = x(mk.x), wpx = mk.label.length * 6.6;
      const left = px + 5 + wpx > W - m.r || (px - lastRight) < 8;
      const tx = left ? px - 5 : px + 5, anchor = left ? "end" : "start";
      svg.appendChild(el("text", { class: "label halo", x: tx, y: m.t + 12, "text-anchor": anchor }, mk.label));
      lastRight = left ? lastRight : px + 5 + wpx;
    });
    if (d.ylabel) svg.appendChild(el("text", { class: "label halo", x: m.l, y: 12 }, d.ylabel));
    const ch = el("line", { class: "crosshair", x1: 0, x2: 0, y1: m.t, y2: m.t + ih }); svg.appendChild(ch);
    const t = tip(host);
    const hit = el("rect", { class: "hit", x: m.l, y: m.t, width: iw, height: ih }); svg.appendChild(hit);
    hit.addEventListener("mousemove", ev => {
      const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width; const i = Math.round((px - m.l) / iw * (n - 1)); if (i < 0 || i >= n) return;
      ch.setAttribute("x1", x(i)); ch.setAttribute("x2", x(i)); ch.classList.add("on");
      const rows = d.series.filter(s => s.values[i] != null).map(s => `${s.name}: <b>${lf(s.values[i])}${unit}</b>`).join("<br>");
      showTip(t, host, x(i), m.t + 4, `${d.x[i]}<br>${rows}`);
    });
    hit.addEventListener("mouseleave", () => { hideTip(t); ch.classList.remove("on"); });
    host.appendChild(svg);
    if (d.series.length > 1) legend(host, d.series.map((s, si) => ({ name: s.name, cls: s.cls || (si === 0 ? "series-1" : si === 1 ? "series-2" : "neutral") })));
    table(host, [d.xhead || "x", ...d.series.map(s => s.name)], d.x.map((lab, i) => [lab, ...d.series.map(s => s.values[i] == null ? "" : lf(s.values[i]) + unit)]));
  }

  /* ----- paired dots ----- */
  function dots(host, d) {
    const W = d.width, n = d.categories.length, rowH = 24, m = { t: 12, r: 24, b: 30, l: Math.min(d.labelWidth || 110, Math.round(W * 0.34)) }, H = m.t + m.b + n * rowH, iw = W - m.l - m.r;
    const unit = d.unit || "";
    const ax = axis(Math.min(...d.before, ...d.after) - 1.5, Math.max(...d.before, ...d.after) + 1.5, 5); const lo = ax.lo, hi = ax.hi;
    const x = v => m.l + (v - lo) / (hi - lo) * iw, tf = fixed(ax.dec);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": d.label || "" });
    const g = el("g", { class: "grid" }); ax.ticks.forEach(v => g.appendChild(el("line", { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }))); svg.appendChild(g);
    ax.ticks.forEach(v => svg.appendChild(el("text", { class: "tick", x: x(v), y: H - m.b + 16, "text-anchor": "middle" }, tf(v) + unit)));
    d.categories.forEach((c, i) => {
      const cy = m.t + rowH * (i + 0.5);
      svg.appendChild(el("line", { x1: x(d.before[i]), x2: x(d.after[i]), y1: cy, y2: cy, stroke: "var(--rule)", "stroke-width": 2 }));
      svg.appendChild(el("circle", { class: "dot neutral", cx: x(d.before[i]), cy, r: 5 }));
      svg.appendChild(el("circle", { class: "dot series-1", cx: x(d.after[i]), cy, r: 5 }));
      svg.appendChild(el("text", { class: "label", x: m.l - 10, y: cy + 4, "text-anchor": "end" }, c));
    });
    host.appendChild(svg);
    legend(host, [{ name: d.names[0], cls: "neutral", shape: "dot" }, { name: d.names[1], cls: "series-1", shape: "dot" }]);
    table(host, [d.xhead || "Item", d.names[0], d.names[1]], d.categories.map((c, i) => [c, fmt(d.before[i]) + unit, fmt(d.after[i]) + unit]));
  }

  /* ----- dated P&L series ----- */
  function pnl(host, d) {
    const x = d.points.map(p => p[0]), v = d.points.map(p => p[1]);
    const mk = (d.markers || []).map(mm => ({ x: Math.max(0, x.findIndex(s => s >= mm.date)), label: mm.label }));
    line(host, { x, series: [{ name: d.name || "P&L", values: v }], markers: mk, zero: true, area: true, dates: true, valfmt: "money", tickfmt: "money", ylabel: d.ylabel, width: d.width, height: d.height, xhead: "Date", label: d.label });
  }

  const R = { bars, hbars, line, dots, pnl };
  function render(host) {
    const src = host.getAttribute("data-src"); const node = src && document.querySelector(src);
    if (!node) return; let d; try { d = JSON.parse(node.textContent); } catch (e) { console.error("chart json", e); return; }
    const cw = host.getBoundingClientRect().width;
    d.width = Math.max(300, Math.min(d.width || 700, cw > 0 ? cw : 700));
    host.dataset.w = String(Math.round(cw));
    host.innerHTML = "";
    const fig = host.closest("figure"); if (fig) fig.querySelectorAll("details.data").forEach(x => x.remove());
    const fn = R[host.getAttribute("data-chart")]; if (fn) fn(host, d);
    host.dataset.done = "1";
  }
  window.renderChart = render;
  window.renderCharts = () => document.querySelectorAll(".chart[data-src]").forEach(h => { if (!h.dataset.done) render(h); });
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { document.querySelectorAll(".chart[data-src][data-done]").forEach(h => { const cw = Math.round(h.getBoundingClientRect().width); if (Math.abs(cw - (+h.dataset.w || 0)) > 40) render(h); }); }, 150); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.renderCharts); else window.renderCharts();
})();
