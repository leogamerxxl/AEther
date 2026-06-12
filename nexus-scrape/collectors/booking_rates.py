"""Competitor rates collector: Apify Booking actor -> rate_observations.

Schema verified live 2026-06-12 against actor oeiQgfg5fsmIJB7Cn:
  item.url (canonical), item.price (top-level RON total), item.currency ("lei"),
  item.rooms[].roomsLeft (availability), item.name, item.stars.
Strategy: one run per stay-date with startUrls = all resolved booking_urls;
match returned items to scraped_properties by URL slug (/hotel/<cc>/<slug>).
Properties without booking_url are skipped (run resolve step first).
Usage: python collectors/booking_rates.py [--dry-run] [--fixture PATH]
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import provenance as pv
from lib.sb import SB, SBError, iso, log_run, ssl_context, today_start_iso, utcnow

AGENT = "collector.booking_rates"
RATES_DAYS = int(os.environ.get("RATES_DAYS", "14"))
MIN_COVERAGE = int(os.environ.get("MIN_RATE_COVERAGE", "10"))
ACTOR = os.environ.get("APIFY_ACTOR", "oeiQgfg5fsmIJB7Cn")


def slug(url):
    """Stable Booking id: the /hotel/<cc>/<name> path, query/fragment stripped."""
    m = re.search(r"/hotel/([a-z]{2})/([^/?#.]+)", (url or "").lower())
    return f"{m.group(1)}/{m.group(2)}" if m else None


def normalize_item(item):
    price = item.get("price")
    try:
        price = round(float(price), 2) if price is not None else None
    except (TypeError, ValueError):
        price = None
    rooms = item.get("rooms") if isinstance(item.get("rooms"), list) else []
    lefts = [r.get("roomsLeft") for r in rooms
             if isinstance(r, dict) and r.get("available") and isinstance(r.get("roomsLeft"), int)]
    rooms_left = min(lefts) if lefts else None
    room_type = next((r.get("roomType") for r in rooms if isinstance(r, dict) and r.get("roomType")), "standard")
    cur = (item.get("currency") or "RON").upper()
    cur = "RON" if cur in ("LEI", "RON") else cur
    sold_out = price is None and not lefts
    return {"slug": slug(item.get("url")), "url": item.get("url"), "name": item.get("name"),
            "price": price, "currency": cur, "room_type": str(room_type)[:120],
            "rooms_left": rooms_left, "availability": "sold_out" if sold_out else "available"}


def run_actor(token, input_obj):
    url = (f"https://api.apify.com/v2/acts/{urllib.parse.quote(ACTOR, safe='')}"
           f"/run-sync-get-dataset-items?token={token}&timeout=300")
    req = urllib.request.Request(url, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": "AetherCollector/1.0"},
                                 data=json.dumps(input_obj).encode())
    with urllib.request.urlopen(req, timeout=330, context=ssl_context()) as r:
        return json.loads(r.read().decode())


def to_row(norm, prop_id, stay_date, now_iso, raw_item):
    if norm["price"] is None and norm["availability"] != "sold_out":
        return None
    row = {"scraped_property_id": prop_id, "source_id": pv.SOURCE_APIFY, "observed_at": now_iso,
           "stay_date": stay_date, "stay_length": 1, "room_type": norm["room_type"],
           "rate_amount": norm["price"] if norm["price"] is not None else 0,
           "currency_code": norm["currency"], "availability_state": norm["availability"],
           "rooms_remaining": norm["rooms_left"], "raw_jsonb": raw_item}
    row["confidence"] = pv.rate_confidence(row) if norm["price"] else 0.5
    return row


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture")
    ap.add_argument("--days", type=int, default=RATES_DAYS)
    a = ap.parse_args(argv)
    started = utcnow()
    now = iso(utcnow())
    summary = {"simulated": bool(a.fixture), "runs": 0, "items": 0, "unmatched": 0,
               "inserted": 0, "patched": 0, "skipped": 0, "coverage": 0}

    if a.fixture:
        items = json.loads(Path(a.fixture).read_text(encoding="utf-8"))
        for it in items:
            n = normalize_item(it)
            print(json.dumps({"matched_slug": n["slug"], "price": n["price"], "cur": n["currency"],
                              "rooms_left": n["rooms_left"], "avail": n["availability"], "name": n["name"]}))
        print(json.dumps({"agent": AGENT, "dry_run": True, "parsed": len(items)}))
        return 0

    try:
        sb = SB()
        token = os.environ["APIFY_API_TOKEN"]
    except (SBError, KeyError) as e:
        print(json.dumps({"agent": AGENT, "status": "failed", "error": f"missing env: {e}"}))
        return 2

    try:
        props = sb.select("scraped_properties", select="id,name,booking_url") or []
        with_url = [p for p in props if p.get("booking_url")]
        slug_map = {slug(p["booking_url"]): p for p in with_url if slug(p["booking_url"])}
        if not slug_map:
            log_run(sb, AGENT, "failed", {}, {"reason": "no booking_url resolved"}, started, error="no booking_url")
            print(json.dumps({"agent": AGENT, "status": "failed",
                              "error": "0 properties have booking_url - run URL resolver first"}))
            return 2

        today = utcnow().date()
        start_urls = [{"url": p["booking_url"]} for p in with_url]
        rows = []
        for d in range(1, a.days + 1):
            checkin = today + timedelta(days=d)
            items = run_actor(token, {
                "startUrls": start_urls, "checkIn": checkin.isoformat(),
                "checkOut": (checkin + timedelta(days=1)).isoformat(),
                "currency": "RON", "language": "en-gb", "maxItems": len(start_urls) * 2,
                "rooms": 1, "adults": 2, "children": 0,
                "starsCountFilter": "any", "propertyType": "none", "minMaxPrice": "0-999999",
            }) or []
            summary["runs"] += 1
            summary["items"] += len(items)
            for item in items:
                n = normalize_item(item)
                prop = slug_map.get(n["slug"])
                if not prop:
                    summary["unmatched"] += 1
                    continue
                row = to_row(n, prop["id"], checkin.isoformat(), now, item)
                if row:
                    rows.append(row)

        existing = sb.select("rate_observations",
                             select="id,scraped_property_id,stay_date,room_type,rate_amount",
                             observed_at=f"gte.{today_start_iso()}") or []
        emap = {(e["scraped_property_id"], e["stay_date"], e["room_type"]): e for e in existing}
        for r in rows:
            k = (r["scraped_property_id"], r["stay_date"], r["room_type"])
            if k in emap:
                sb.patch("rate_observations", {"id": f"eq.{emap[k]['id']}"},
                         {"rate_amount": r["rate_amount"], "availability_state": r["availability_state"],
                          "rooms_remaining": r["rooms_remaining"], "confidence": r["confidence"],
                          "observed_at": r["observed_at"], "raw_jsonb": r["raw_jsonb"]})
                summary["patched"] += 1
            else:
                sb.insert("rate_observations", [r])
                summary["inserted"] += 1

        covered = {r["scraped_property_id"] for r in rows} | {e["scraped_property_id"] for e in existing}
        summary["coverage"] = len(covered)
        status = "succeeded" if summary["coverage"] >= MIN_COVERAGE else ("degraded" if summary["coverage"] else "failed")
        log_run(sb, AGENT, status, {"actor": ACTOR, "days": a.days, "urls": len(start_urls)}, summary, started)
        print(json.dumps({"agent": AGENT, "status": status, **summary}, indent=2))
        return 0 if status != "failed" else 2
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", {"actor": ACTOR}, summary, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())