"""Assemble the site: wrap every page fragment in src/ with the shared header and footer.

    python tools/build.py

A fragment starts with a small front-matter block:

    <!--
    title: Page title
    description: one sentence for <meta name=description>
    section: work | notes | home
    path: work/phantom/          (output directory, index.html is written inside)
    scripts: charts              (optional; comma-separated: charts)
    extra_scripts: live.js       (optional)
    -->
Inside the body, ``<!--rt-->`` (in the kicker) becomes the reading time and ``<!-- toc -->``
becomes an "On this page" list of the h2 headings when there are at least four of them.
    ...body html...

No dependencies beyond the standard library. Output files are plain HTML and are committed.
"""
import pathlib, re, sys, hashlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
SITE = "Alexandre Dalban"
BASE = "https://adnocap.github.io"

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<link rel="canonical" href="{url}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23161616'/%3E%3Cpath d='M6 24 L13 9 L20 24 M9 19 h8 M22 14 h5 M22 19 h5' stroke='%23fbfbf9' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{rel}style.css?v={ver}">
<script>(function(){{var m=/[?&]theme=(light|dark)/.exec(location.search);if(m)document.documentElement.setAttribute("data-theme",m[1]);}})();</script>
</head>
<body>
<header class="site-head">
  <a class="brand" href="{rel}">{site}</a>
  <nav aria-label="Site">
    <a href="{rel}#work"{cur_work}>Work</a>
{draft_nav}  </nav>
</header>
"""

FOOT = """
<footer class="site-foot">
  <span>Alexandre Dalban &middot; <a href="mailto:alexandre.dalban@gmail.com">alexandre.dalban@gmail.com</a></span>
  <span><a href="https://github.com/ADnocap">GitHub</a> &middot; <a href="https://www.linkedin.com/in/alexdalban">LinkedIn</a> &middot; <a href="{rel}assets/Alexandre_Dalban_CV.pdf">CV</a></span>
</footer>
{scripts}
</body>
</html>
"""

def parse(text):
    m = re.match(r"\s*<!--(.*?)-->\s*", text, re.S)
    if not m:
        raise SystemExit("missing front matter")
    meta = {}
    for ln in m.group(1).strip().splitlines():
        if ":" in ln:
            k, v = ln.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, text[m.end():]

SPY = """<script>(function(){var t=document.querySelector('.toc');if(!t)return;var links=[].slice.call(t.querySelectorAll('a[href^="#"]'));var hs=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1));}).filter(Boolean);function on(){var y=window.scrollY+140,cur=hs[0];hs.forEach(function(h){if(h.offsetTop<=y)cur=h;});links.forEach(function(a){a.parentNode.classList.toggle('on',!!cur&&a.getAttribute('href')==='#'+cur.id);});}window.addEventListener('scroll',on,{passive:true});window.addEventListener('resize',on);on();})();</script>
"""

OUT_ROOT = ROOT     # --drafts redirects every page into _preview/ so the real tree is never touched
NAV_EXTRA = []      # (label, path, section) for pages that declare `nav:`; see main()
LEDGER_EXTRA = ""   # ledger rows contributed by draft pages, home page only


def filter_counts(body):
    """Keep the ledger's filter counts in step with the rows actually present."""
    types = re.findall(r'<li data-type="([^"]+)"', body)
    if not types:
        return body
    counts = {"all": len(types)}
    for t in types:
        counts[t] = counts.get(t, 0) + 1
    def fix(m):
        return f'{m.group(1)}<small>{counts.get(m.group(2), 0)}</small>'
    return re.sub(r'(<button[^>]*data-filter="([^"]+)"[^>]*>[^<]*)<small>\d+</small>', fix, body)


def slug(text):
    t = re.sub(r"<[^>]+>", "", text)
    t = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return t[:60].rstrip("-") or "section"

def enrich(body):
    """Give every h2 an id, replace the reading-time and table-of-contents markers."""
    seen = set()
    heads = []
    def fix(m):
        attrs, text = m.group(1), m.group(2)
        idm = re.search(r'id="([^"]+)"', attrs)
        if idm:
            hid = idm.group(1)
        else:
            hid = slug(text)
            base, n = hid, 2
            while hid in seen:
                hid = f"{base}-{n}"; n += 1
            attrs = f' id="{hid}"' + attrs
        seen.add(hid)
        heads.append((hid, re.sub(r"<[^>]+>", "", text)))
        return f"<h2{attrs}>{text}</h2>"
    body = re.sub(r"<h2([^>]*)>(.*?)</h2>", fix, body, flags=re.S)
    text = re.sub(r'<script type="application/json".*?</script>', "", body, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    words = len(text.split())
    minutes = max(1, round(words / 230))
    body = body.replace("<!--rt-->", f" &middot; {minutes} min read")
    spy = ""
    if "<!-- toc -->" in body:
        if len(heads) >= 4:
            items = "\n".join(f'<li><a href="#{h}">{t}</a></li>' for h, t in heads)
            nav = ('<div class="toc-wrap"><nav class="toc" aria-label="On this page"><p class="toc-h">On this page</p>\n<ol>\n'
                   + items + "\n</ol></nav></div>")
            body = body.replace("<!-- toc -->", nav)
            spy = SPY
        else:
            body = body.replace("<!-- toc -->", "")
    return body, spy

def build_one(path):
    meta, body = parse(path.read_text(encoding="utf-8"))
    out_dir = OUT_ROOT / meta.get("path", "")
    depth = len([p for p in meta.get("path", "").split("/") if p])
    rel = "../" * depth or "./"
    section = meta.get("section", "")
    url = BASE + "/" + meta.get("path", "")
    scripts = ""
    if "charts" in meta.get("scripts", ""):
        scripts += f'<script src="{rel}charts.js?v={VER}" defer></script>\n'
    for extra in meta.get("extra_scripts", "").split(","):
        extra = extra.strip()
        if extra:
            scripts += f'<script src="{rel}{extra}?v={VER}" defer></script>\n'
    if section == "home":
        if LEDGER_EXTRA:
            body = body.replace('<li class="year">2026</li>', '<li class="year">2026</li>\n' + LEDGER_EXTRA, 1)
        body = filter_counts(body)
    body, spy = enrich(body)
    scripts += spy
    draft_nav = "".join(
        '    <a href="{}{}"{}>{}</a>\n'.format(rel, npath, ' aria-current="page"' if section == nsec else "", label)
        for label, npath, nsec in NAV_EXTRA)
    html = HEAD.format(
        title=meta["title"], description=meta.get("description", ""), url=url, rel=rel, site=SITE, ver=VER,
        cur_work=' aria-current="page"' if section == "work" else "", draft_nav=draft_nav,
    ) + body.strip() + FOOT.format(rel=rel, scripts=scripts)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(html, encoding="utf-8", newline="\n")
    return out_dir / "index.html"

def asset_version():
    """Short hash of the shared assets, appended as ?v= so browsers and GitHub Pages never serve a stale stylesheet."""
    h = hashlib.sha1()
    for name in ("style.css", "charts.js", "live.js"):
        f = ROOT / name
        if f.exists():
            h.update(f.read_bytes())
    return h.hexdigest()[:8]

VER = asset_version()

def main():
    global LEDGER_EXTRA, OUT_ROOT
    pages = sorted(SRC.rglob("*.html"))
    drafts = "--drafts" in sys.argv[1:]
    if drafts:
        OUT_ROOT = ROOT / "_preview"
        pages += sorted(p for p in (ROOT / "drafts").glob("*.html") if not p.name.endswith(".ledger.html"))
        LEDGER_EXTRA = "".join(f.read_text(encoding="utf-8").strip() + "\n"
                               for f in sorted((ROOT / "drafts").glob("*.ledger.html")))
    for p in pages:                       # nav entries are global, so collect them first
        meta, _ = parse(p.read_text(encoding="utf-8"))
        if meta.get("nav"):
            NAV_EXTRA.append((meta["nav"], meta.get("path", ""), meta.get("section", "")))
    for p in pages:
        out = build_one(p)
        note = "  (draft)" if p.parent.name == "drafts" else ""
        print("wrote", out.relative_to(ROOT), note)
    if drafts:
        print("\nDraft pages built for local preview only. Their output paths are in .gitignore;\n"
              "see drafts/README.md for how to publish one properly.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
