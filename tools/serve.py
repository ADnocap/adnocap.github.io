"""Local preview server for the site.

    python tools/serve.py [port]

Two things the stdlib server doesn't do:

* **No caching.** http.server sends Last-Modified, so a browser will happily keep showing a
  stale page after a rebuild. This sends no-store and never sets Last-Modified, so what you
  reload is always what's on disk.
* **_preview/ overlay.** `python tools/build.py --drafts` writes into _preview/. Anything
  found there is served first, and everything else (style.css, assets/, data/, the pages
  built normally) falls through to the repository root. So a draft build is visible without
  a single draft byte landing in the committed tree.
"""
import functools, http.server, pathlib, socketserver, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "_preview"


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        real = pathlib.Path(super().translate_path(path))
        try:
            rel = real.relative_to(ROOT)
        except ValueError:
            return str(real)
        candidate = PREVIEW / rel
        if candidate.exists() or (candidate / "index.html").exists():
            return str(candidate)
        return str(real)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, keyword, value):
        if keyword == "Last-Modified":  # drop it, so no conditional requests are made
            return
        super().send_header(keyword, value)

    def log_message(self, fmt, *args):
        code = args[1] if len(args) > 1 else ""
        if code != "200":
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    # Deliberately NOT allow_reuse_address: on Windows that lets a second server bind the
    # same port, and you then get answers from whichever one happens to win. Fail loudly.
    try:
        # threading, or the browser's parallel requests for CSS, fonts and charts queue up
        # behind each other and the page appears to hang
        http.server.ThreadingHTTPServer.daemon_threads = True
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port),
                                                functools.partial(Handler, directory=str(ROOT)))
    except OSError as e:
        print(f"port {port} is already in use ({e}). Stop the other server first, or pass "
              f"a different port: python tools/serve.py {port + 1}")
        return 1
    overlay = "on" if PREVIEW.is_dir() else "off (run: python tools/build.py --drafts)"
    print(f"serving {ROOT} at http://127.0.0.1:{port}/")
    print(f"  caching disabled, _preview/ overlay {overlay}")
    with httpd:
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    main()
