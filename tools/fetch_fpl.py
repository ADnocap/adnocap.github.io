"""Refresh data/fpl.json from the public Fantasy Premier League API.

Run weekly (GitHub Action) or by hand:  python tools/fetch_fpl.py
Only public endpoints are used; no login or token is needed.
"""
import json, sys, urllib.request, datetime, pathlib

ENTRY = 8737706  # public FPL entry id of the entry the model plans for
UA = {"User-Agent": "Mozilla/5.0 (portfolio tracker; github.com/ADnocap)"}
BASE = "https://fantasy.premierleague.com/api"

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    boot = get(f"{BASE}/bootstrap-static/")
    entry = get(f"{BASE}/entry/{ENTRY}/")
    hist = get(f"{BASE}/entry/{ENTRY}/history/")
    events = {e["id"]: e for e in boot["events"]}
    season = None
    # bootstrap-static carries no explicit season string; derive from the first deadline year
    first = boot["events"][0]["deadline_time"][:4]
    season = f"{first}/{str(int(first)+1)[-2:]}"
    gws = []
    for row in hist.get("current", []):
        ev = events.get(row["event"], {})
        gws.append({
            "gw": row["event"],
            "points": row["points"],
            "total": row["total_points"],
            "rank": row["overall_rank"],
            "gw_rank": row.get("rank"),
            "transfers": row.get("event_transfers", 0),
            "hit": row.get("event_transfers_cost", 0),
            "bench": row.get("points_on_bench", 0),
            "value": row.get("value"),
            "average": ev.get("average_entry_score"),
            "highest": ev.get("highest_score"),
            "chip": None,
        })
    for c in hist.get("chips", []):
        for g in gws:
            if g["gw"] == c["event"]:
                g["chip"] = c["name"]
    finished = [e for e in boot["events"] if e["finished"]]
    out = {
        "updated_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "season": season,
        "entry_id": ENTRY,
        "team_name": entry.get("name"),
        "overall_points": entry.get("summary_overall_points"),
        "overall_rank": entry.get("summary_overall_rank"),
        "total_players": boot.get("total_players"),
        "gameweeks_finished": len(finished),
        "gameweeks": gws,
        "source": "fantasy.premierleague.com public API (entry history + bootstrap-static)",
    }
    path = pathlib.Path(__file__).resolve().parents[1] / "data" / "fpl.json"
    path.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"wrote {path}: GW{len(gws)} total={out['overall_points']} rank={out['overall_rank']}")

if __name__ == "__main__":
    sys.exit(main())
