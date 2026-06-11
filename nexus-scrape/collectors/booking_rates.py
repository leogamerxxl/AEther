"""Competitor rates collector: Apify Booking actor -> rate_observations. Plan s2.

Real mode: runs APIFY_ACTOR (run-sync-get-dataset-items) once per check-in date
for the next RATES_DAYS days (default 14, horizon ramps at deploy), maps items
to scraped_properties by booking_url/external_id, upserts idempotently per
(scraped_property_id, stay_date, room_type) per observation day.

DEPLOY-DAY SEAM (plan s12.3): normalize_item() maps the chosen actor's output
to the normalized shape below - verify against the actor's real schema before
first live run. Fixture mode (--fixture) consumes pre-normalized items.

Normalized item: property_external_id | url, stay_date, room_type, price,
currency, availability, rooms_left, refundable, breakfast, genius.
Usage: python collectors/booking_rates.py [--dry-run] [--fixture PATH]
"""
import argparse
import json
import os
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
ACTOR = os.environ.get("APIFY_ACTOR", "voyager~booking-scraper")


def normalize_item(item, fallback_stay_date):
    """Adapter seam: tolerant mapping over common Booking-actor field names."""
    def first(*keys):
        for k in keys:
            v = item.get(k)
            if v not in (None, ""):
                return v
        return None
    price = first("price", "totalPrice", "minPrice")
    try:
        price = round(float(price), 2) if price is not None else None
    except (TypeError, ValueError):
        price = None
    rooms_left = first("rooms_left", "roomsLeft", "availableRooms")
    try:
        rooms_left = int(rooms_left) if rooms_left is not None else None
    except (TypeError, ValueError):
        rooms_left = None
    sold_out = bool(first("soldOut", "sold_out")) or (rooms_left == 0)
    return {
        "property_external_id": first("property_external_id", "hotelId", "id"),
        "url": first("url", "hotelUrl", "link"),
        "stay_date": first("stay_date", "checkIn", "checkInDate") or fallback_stay_date,
        "room_type": first("room_type", "roomType", "roomName") or "standard",
        "price": price,
        "currency": (first("currency", "currencyCode") or "RON").upper(),
        "availability": "sold_out" if sold_out else (first("availability") or "available"),
        "rooms_left": rooms_left,
        "refundable": first("refundable", "isRefundable"),
        "breakfast": first("breakfast", "hasBreakfast"),
        "genius": first("genius", "isGenius"),
    }


def run_actor(token, input_obj):
    url = (f"https://api.apify.com/v2/acts/{urllib.parse.quote(ACTOR, safe='~')}"
           f"/run-sync-get-dataset-items?token={token}&timeout=300")
    req = urllib.request.Request(url, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": "AetherCollector/1.0"},
                                 data=json.dumps(input_obj).encode())
    with urllib.request.urlopen(req, timeout=330, context=ssl_context()) as r:
        return json.loads(r.read().decode())


def match_property(norm, props):
    ext = str(norm.get("property_external_id") or "")
    url = str(norm.get("url") or "")
    for p in props:
        if ext and str(p.get("external_id")) == ext:
            return p
        bu = p.get("booking_url") or ""
        if url and bu and (url.startswith(bu.split("?")[0]) or bu.split("?")[0] in url):
            return p
    return None


def to_row(norm, prop_id, now_iso, raw_item):
    if norm["price"] is None or not norm["stay_date"]:
        return None
    row = {
        "scraped_property_id": prop_id, "source_id": pv.SOURCE_APIFY,
        "observed_at": now_iso, "stay_date": str(norm["stay_date"])[:10],
        "stay_length": 1, "room_type": str(norm["room_type"])[:120],
        "rate_amount": norm["price"], "currency_code": norm["currency"],
        "availability_state": norm["availability"], "rooms_remaining": norm["rooms_left"],
        "is_refundable": bool(norm["refundable"]) if norm["refundable"] is not None else None,
        "has_breakfast": bool(norm["breakfast"]) if norm["breakfast"] is not None else None,
        "is_genius": bool(norm["genius"]) if norm["genius"] is not None else None,
        "raw_jsonb": raw_item,
    }
    row["confidence"] = pv.rate_confidence(row)
    return row


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture")
    a = ap.parse_args(argv)
    started = utcnow()
    now = iso(utcnow())
    summary = {"simulated": bool(a.fixture), "items": 0, "parse_failures": 0,
               "unmatched": 0, "inserted": 0, "patched": 0, "skipped": 0, "coverage": 0}

    if a.fixture:
        items = json.loads(Path(a.fixture).read_text(encoding="utf-8"))
        norms = [normalize_item(i, None) for i in items]
        summary["items"] = len(norms)
        rows = []
        for n, raw in zip(norms, items):
            r = to_row(n, n.get("property_external_id") or "UNRESOLVED(fixture)", now, raw)
            if r is None:
                summary["parse_failures"] += 1
            else:
                rows.append(r)
        summary["coverage"] = len({r["scraped_property_id"] for r in rows})
        if a.dry_run:
            preview = [{k: r[k] for k in ("scraped_property_id", "stay_date", "room_type",
                                          "rate_amount", "currency_code", "availability_state",
                                          "rooms_remaining", "confidence")} for r in rows]
            print(json.dumps({"agent": AGENT, "dry_run": True, **summary, "preview": preview}, indent=2))
            return 0
        print(json.dumps({"agent": AGENT, "status": "failed",
                          "error": "fixture mode cannot write (unresolved property ids)"}))
        return 2

    try:
        sb = SB()
        token = os.environ["APIFY_API_TOKEN"]
    except (SBError, KeyError) as e:
        print(json.dumps({"agent": AGENT, "status": "failed", "error": f"missing env: {e}"}))
        return 2

    try:
        props = sb.select("scraped_properties", select="id,external_id,booking_url,name") or []
        if not props:
            raise ValueError("no scraped_properties configured")
        today = utcnow().date()
        rows = []
        for d in range(1, RATES_DAYS + 1):
            checkin = today + timedelta(days=d)
            items = run_actor(token, {
                "startUrls": [{"url": p["booking_url"]} for p in props if p.get("booking_url")],
                "checkIn": checkin.isoformat(),
                "checkOut": (checkin + timedelta(days=1)).isoformat(),
                "currency": "RON", "language": "en-us", "maxItems": 200,
            }) or []
            summary["items"] += len(items)
            for item in items:
                norm = normalize_item(item, checkin.isoformat())
                prop = match_property(norm, props)
                if prop is None:
                    summary["unmatched"] += 1
                    continue
                row = to_row(norm, prop["id"], now, item)
                if row is None:
                    summary["parse_failures"] += 1
                else:
                    rows.append(row)

        existing = sb.select("rate_observations",
                             select="id,scraped_property_id,stay_date,room_type,rate_amount",
                             observed_at=f"gte.{today_start_iso()}") or []
        emap = {(e["scraped_property_id"], e["stay_date"], e["room_type"]): e for e in existing}
        for r in rows:
            k = (r["scraped_property_id"], r["stay_date"], r["room_type"])
            if k in emap:
                if float(emap[k]["rate_amount"] or 0) != float(r["rate_amount"]):
                    sb.patch("rate_observations", {"id": f"eq.{emap[k]['id']}"},
                             {"rate_amount": r["rate_amount"], "availability_state": r["availability_state"],
                              "rooms_remaining": r["rooms_remaining"], "confidence": r["confidence"],
                              "observed_at": r["observed_at"], "raw_jsonb": r["raw_jsonb"]})
                    summary["patched"] += 1
                else:
                    summary["skipped"] += 1
            else:
                sb.insert("rate_observations", [r])
                summary["inserted"] += 1

        covered = {r["scraped_property_id"] for r in rows} | {e["scraped_property_id"] for e in existing}
        summary["coverage"] = len(covered)
        status = "succeeded" if summary["coverage"] >= MIN_COVERAGE else ("degraded" if summary["coverage"] > 0 else "failed")
        log_run(sb, AGENT, status, {"actor": ACTOR, "days": RATES_DAYS}, summary, started)
        print(json.dumps({"agent": AGENT, "status": status, **summary}, indent=2))
        return 0 if status != "failed" else 2
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", {"actor": ACTOR, "days": RATES_DAYS}, summary, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())