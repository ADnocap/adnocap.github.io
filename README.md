# adnocap.github.io

Personal site of Alexandre Dalban. Hand-written HTML, CSS and SVG; no framework, no build dependency beyond Python's standard library.

## Layout

- `src/` page fragments with a small front-matter block (title, description, section, output path). Edit these, not the built files.
- `tools/build.py` wraps every fragment in the shared header and footer and writes `index.html` files into place. Run `python tools/build.py` after editing anything in `src/`.
- `style.css` the whole design system, including the self-hosted `@font-face` rules (regenerate with `python tools/fetch_fonts.py`; the woff2 files live in `assets/fonts/`). `charts.js` renders the SVG charts from the JSON blocks embedded in each page (every chart also gets a data-table twin). `live.js` fills the charts that read JSON files under `data/`.
- `assets/fig/<project>/` figures, downscaled to 1,800 px or less. `assets/img/` the portrait. `assets/Alexandre_Dalban_CV.pdf` the one-page CV, `assets/quant-ai-interview-notes.pdf` the interview notes behind `/notes/`.
- `data/fpl.json` the Fantasy Premier League tracker data; refreshed weekly by `.github/workflows/fpl.yml`, which runs `tools/fetch_fpl.py` against the public FPL API and commits the result. `data/polymarket_pnl.json` is a dated snapshot of the public Polymarket P&L endpoint for the wallet linked from the trading write-up.
- `.nojekyll` tells GitHub Pages to serve the files as they are.
- `drafts/` holds pages that are written but not published. Gitignored, and a normal build never looks in it. See `drafts/README.md`.
- `tools/count_god_notes.py` re-derives every figure quoted on `/notes/` from the source LaTeX and PDF. Run it after revising that document.

## Editing

1. Change a fragment in `src/`.
2. `python tools/build.py`
3. Check locally: `python tools/serve.py` and open `http://127.0.0.1:8765/`. It disables caching, so a reload always shows the latest build. Append `?theme=light` or `?theme=dark` to a page URL to preview either colour scheme regardless of the OS setting.
   To include unpublished pages, `python tools/build.py --drafts` first: that writes the whole site into the gitignored `_preview/`, which the server overlays on the real tree.
4. Commit the fragment and the built file together.

Adding a project page: copy any `src/work/*.html` fragment, keep the front-matter keys, and add a row to the ledger in `src/index.html`. The ledger's filter counts are computed at build time, so they never need editing. Add `nav: Label` to a fragment's front matter to give it a tab in the header.

## Charts

A chart is `<div class="chart" data-chart="bars|hbars|line|dots|pnl" data-src="#some-json"></div>` followed by `<script type="application/json" id="some-json">{...}</script>`. Formatters can be named in the JSON (`"valfmt": "int"`, `"tickfmt": "compact"`, `"money"`, `"pct1"`). Blue is reserved for the site's own results, grey for baselines, red for losses and retracted numbers.
