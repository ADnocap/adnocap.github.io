"""Re-measure every number quoted on the interview-notes page (drafts/god-notes.html).

    python tools/count_god_notes.py [path/to/god_notes/dir]

Defaults to D:/ai-job-search/interview_prep/god_notes. Prints the counts so they can be
checked against the page before publishing; the document is still being revised, so the
figures move.
"""
import csv, collections, pathlib, re, sys

B = chr(92)  # backslash, kept out of the regex literals below
DEFAULT = pathlib.Path("D:/ai-job-search/interview_prep/god_notes")

PARTS = [
    ("I. Probability and games", ["1", "2", "3"]),
    ("II. Statistics and regression", ["4", "5"]),
    ("III. Linear algebra and calculus", ["6", "7"]),
    ("IV. Machine learning and deep learning", ["8", "9"]),
    ("V. Trading and market structure", ["10", "11", "12", "13", "14", "15", "16"]),
    ("VI. Interview craft", ["17", "18"]),
    ("VII. Computer science", ["19"]),
    ("VIII. Puzzle classics", ["PZ"]),
]


def main(root=DEFAULT):
    tex = (root / "god_notes.tex").read_text(encoding="utf-8")
    pdf = (root / "god_notes.pdf").read_bytes()

    counts = re.findall(rb"/Count (\d+)", pdf)
    print(f"pages           {max(int(c) for c in counts) if counts else '?'}")
    print(f"size            {len(pdf) / 1048576:.2f} MB")
    print(f"parts           {len(re.findall(B + B + r'part{', tex))}")
    print(f"sections        {len(re.findall(B + B + r'section{', tex))}  (incl. Problem Bank and Solutions)")

    # provenance marks: the bank repeats each mark in its solution, so split the document
    cut = tex.find(B + "section{Problem Bank}")
    body, bank = tex[:cut], tex[cut:tex.find(B + "section{Solutions}")]
    for name, label in (("askedlive", "live interview"), ("askedoa", "online assessment")):
        pat = B + B + name
        print(f"{name:15} {len(re.findall(pat, bank)):3} in bank + {len(re.findall(pat, body)) - 1:2} in body  ({label})")

    for env in ("theorem", "proposition", "definition", "fact", "proof", "example",
                "intuition", "trap", "application"):
        print(f"{env:15} {len(re.findall(B + B + r'begin{' + env + '}', tex))}")

    rows = list(csv.DictReader(open(root / "problem_tracker.csv", encoding="utf-8")))
    by_section = collections.Counter(r["section"] for r in rows)
    print(f"\nproblems        {len(rows)}")
    for title, secs in PARTS:
        print(f"  {title:42} {sum(by_section[s] for s in secs)}")
    unseen = set(by_section) - {s for _, secs in PARTS for s in secs}
    if unseen:
        print(f"  UNMAPPED sections: {sorted(unseen)}")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT)
