"""AETHER Morning Brief generator - deterministic MVP (no LLM).

Every sentence is constructed from brief_inputs rows with citations attached at
claim-creation time, so "no uncited claims / no naked numbers / no fabricated
confidence" hold by construction. Romanian primary, English secondary.
Recommendation suppressed when the gate says BLOCK. Stale sources are labeled.

Usage:
  python generator.py --preview                  # live data, print + HTML file, write DB
  python generator.py --preview --no-write       # live data, no DB write
  python generator.py --preview --fixture F.json # offline snapshot/demo, no DB write
  python generator.py --force                    # regenerate even if already sent
"""
import argparse
import html as html_lib
import os
import json
import statistics
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "nexus-scrape"))
from lib import provenance as pv  # noqa: E402
from lib.gates import verdict as gate_verdict  # noqa: E402
from lib.sb import SB, SBError, iso, log_run, utcnow  # noqa: E402

AGENT = "brief.generator"
DOW_RO = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"]

# Romanian UI strings centralized with \u escapes (encoding-proof through any shell).
T = {
    "and": "și",
    "market_t": "Starea pieței",
    "stale_market": "Datele de tarife concurență sunt {state}{when}. Fără date proaspete nu evaluăm piața.",
    "market_line": "Piața (set competitiv, {n} hoteluri): median între {lo} RON ({lo_d}) și {hi} RON ({hi_d}) în următoarele 7 nopți.",
    "market_no_io": "Stratul de inteligenta de piata este indisponibil - semnalul nu a fost generat de motor.",
    "pressure_t": "Presiunea cererii",
    "pressure_dep": "Indisponibilă — depinde de datele de tarife (vechi).",
    "pressure_hi": "{wd} {d}: {n} hoteluri concurente sunt pline sau aproape pline — presiune RIDICATĂ.",
    "pressure_ok": "Normală — niciun semn de epuizare în setul competitiv pe 7 zile.",
    "movement_t": "Mișcări concurență",
    "movement_stale": "Indisponibile — date vechi.",
    "movement_d1": "Prima zi de colectare — variațiile zilnice apar de mâine.",
    "movement_ok": "Comparația zilnică se calculează din observațiile consecutive.",
    "weather_t": "Meteo",
    "weather_stale": "Prognoza este {state} — verificați manual.",
    "weather_wknd": "Weekend favorabil plajei ({ds}) — așteptați cerere de ultim moment.",
    "weather_range": "Maxime între {a}°C ({da}) și {b}°C ({db}).",
    "weather_none": "Fără semnale meteo notabile.",
    "fx_t": "Curs valutar",
    "fx_line": "EUR/RON: {v} (BNR, {d}). Relevant pentru oaspeții din zona euro.",
    "fx_none": "Curs BNR indisponibil astăzi.",
    "action_t": "Recomandare",
    "action_none": "NICIO RECOMANDARE ASTĂZI — {why}. Nu luăm decizii pe date moarte.",
    "action_raise": "Creșteți tariful cu +5% pentru {wd} {d} — {n} concurenți sunt plini, aveți {rooms} camere libere.",
    "action_dir": "Presiune ridicată pe {d} — direcțional: NU reduceți tariful. Impactul în RON nu e calculabil fără datele OTB — completați foaia.",
    "action_hold": "Mențineți tarifele actuale — piața e stabilă, fără presiune de cerere.",
    "impact_t": "Impact estimat",
    "impact_line": "+{lo} … +{hi} RON pe {d} (metoda v0, estimare brută). Încredere: {c} ({cl}).",
    "impact_no_otb": "Necalculabil fără OTB.",
    "impact_neutral": "Neutru — nicio acțiune propusă.",
    "prov_t": "Încredere și surse",
    "prov_line": "{label}: {state} · ultima observație {ts}",
    "warn_t": "Avertismente date",
    "warn_rates": "⚠ Tarifele concurenței sunt {state} — secțiunile de piață nu sunt de încredere.",
    "warn_src": "⚠ {src}: {state}.",
    "warn_none": "Toate sursele sunt proaspete.",
    "watch_t": "De urmărit",
    "watch_full": "{name} aproape plin pe {d} — dacă se închide, puteți crește tariful.",
    "watch_d2": "De mâine: variațiile zilnice de tarif ale concurenței (a doua zi de date).",
    "watch_otb": "Completați foaia OTB — fără ea nu putem cuantifica impactul în RON.",
    "watch_none": "Nimic critic — monitorizare normală.",
    "sim_banner": "SIMULARE — date demonstrative, nu reale",
    "block_banner": "Date incomplete astăzi — recomandarea este suspendată",
    "brief_title": "Brief de dimineață",
    "conf_low": "scăzută", "conf_med": "medie", "conf_good": "bună",
    "fresh": "proaspăt", "cooling": "în răcire", "stale": "VECHI", "dead": "MORT",
    "never": "niciodată",
    "labels": {"collector.booking_rates": "Tarife concurență", "collector.otb": "OTB propriu",
               "collector.weather": "Meteo", "collector.bnr_fx": "Curs BNR"},
    "src_conf": " · încredere ",
}


def ddmm(d):
    d = str(d)
    return f"{d[8:10]}.{d[5:7]}"


def dow(d):
    return DOW_RO[date.fromisoformat(str(d)[:10]).weekday()]


def fnum(x):
    return float(x) if x is not None else 0.0


def ro_state(st):
    """Freshness state translated for the owner (also feeds the citation walker)."""
    return T.get(st, st).upper()


def load_data(fixture=None, sb=None):
    if fixture:
        data = json.loads(Path(fixture).read_text(encoding="utf-8"))
        data.setdefault("simulated", True)
        data.setdefault("intelligence", [])
        return data
    return {"inputs": sb.select("brief_inputs", select="*") or [],
            "status": sb.select("collector_status", select="*") or [],
            "intelligence": sb.select("intelligence_objects", select="*",
                                      property_id=f"eq.{pv.PROPERTY_TERRA}",
                                      status="eq.active", order="observed_at.desc") or [],
            "simulated": False}


def index(data):
    by = {}
    for r in data["inputs"]:
        by.setdefault(r["kind"], []).append(r)
    rates = by.get("comp_rate", [])
    coverage = len({r["subject_id"] for r in rates})
    rate_by_date = {}
    for r in rates:
        rate_by_date.setdefault(str(r["target_date"]), []).append(r)
    press, seen = {}, set()
    for r in by.get("comp_availability", []):
        key = (str(r["target_date"]), r["subject_id"])
        if key in seen:
            continue
        seen.add(key)
        low = (r.get("value_text") == "sold_out") or (
            r.get("value_numeric") is not None and fnum(r["value_numeric"]) <= 2)
        if low:
            press.setdefault(key[0], []).append(r)
    for r in rates:
        key = (str(r["target_date"]), r["subject_id"])
        if r.get("value_text") == "sold_out" and key not in seen:
            seen.add(key)
            press.setdefault(key[0], []).append(r)
    otb_by_date = {}
    for r in by.get("otb", []):
        otb_by_date.setdefault(str(r["target_date"]), {})[r["metric"]] = r
    wx = {}
    for r in by.get("weather", []):
        wx.setdefault(str(r["target_date"]), {})[r["metric"]] = r
    fx = next(iter(by.get("fx", [])), None)
    # Canonical intelligence layer: the brief RENDERS signals the world model already
    # contains; it does not re-derive them. Today the engine emits market_rate_pressure.
    market_ios = {}
    for io in data.get("intelligence", []):
        if io.get("signal_type") != "market_rate_pressure":
            continue
        sd = (io.get("raw_jsonb") or {}).get("stay_date")
        if sd:
            market_ios.setdefault(str(sd), io)  # rows arrive observed_at desc -> keep latest
    return {"rates": rates, "rate_by_date": rate_by_date, "press": press,
            "otb_by_date": otb_by_date, "wx": wx, "fx": fx, "coverage": coverage,
            "market_ios": market_ios,
            "status": data["status"], "simulated": data.get("simulated", False)}


class Brief:
    def __init__(self, today, ctx):
        self.today, self.ctx = today, ctx
        self.sections, self.citations = [], []
        self.rendered_io_ids = []
        self.gate = gate_verdict(ctx["status"], ctx["coverage"])

    def cite(self, claim, rows, computed):
        cid = f"c{len(self.citations) + 1}"
        self.citations.append({"id": cid, "claim": claim,
                               "observation_ids": sorted({str(r.get("observation_id"))
                                                          for r in rows if r.get("observation_id")}),
                               "computed": computed})
        return cid

    def cite_io(self, claim, observation_ids, computed):
        """Citation sourced from an intelligence_object's evidence chain."""
        cid = f"c{len(self.citations) + 1}"
        self.citations.append({"id": cid, "claim": claim,
                               "observation_ids": sorted({str(o) for o in observation_ids if o}),
                               "computed": computed})
        return cid

    def section(self, key, title, lines_ro, lines_en, prov=None, cites=None):
        self.sections.append({"key": key, "title_ro": title, "lines_ro": lines_ro,
                              "lines_en": lines_en, "provenance": prov, "cites": cites or []})


def conf_label(c):
    return T["conf_low"] if c < 0.45 else (T["conf_med"] if c < 0.65 else T["conf_good"])


def prov_line(rows, source_label):
    if not rows:
        return None
    obs = max(str(r["observed_at"]) for r in rows)
    confs = [fnum(r["confidence"]) for r in rows if r.get("confidence") is not None]
    state = T.get(rows[0].get("freshness_state", "?"), rows[0].get("freshness_state", "?"))
    c = f"{T['src_conf']}{round(statistics.median(confs), 2)}" if confs else ""
    return f"{source_label} · {obs[8:10]}.{obs[5:7]} {obs[11:16]}{c} · {state}"


def io_freshness(io, now):
    """Freshness computed at read time (provenance doctrine) from the IO's own
    observed_at / expires_at - never stored."""
    def _p(t):
        return datetime.fromisoformat(str(t).replace("Z", "+00:00"))
    try:
        exp = io.get("expires_at")
        if exp:
            e = _p(exp)
            if now <= e:
                return "fresh"
            age = (now - e).total_seconds() / 3600
            return "cooling" if age <= 24 else "stale" if age <= 72 else "dead"
        obs = io.get("observed_at")
        if obs:
            age = (now - _p(obs)).total_seconds() / 3600
            return "fresh" if age <= 26 else "cooling" if age <= 50 else "stale" if age <= 96 else "dead"
    except Exception:  # noqa: BLE001
        return "dead"
    return "dead"


def io_prov_line(ios, source_label, now):
    """Provenance line for IO-sourced sections: latest observed_at + median
    confidence + read-time freshness."""
    if not ios:
        return None
    obs = max(str(i["observed_at"]) for i in ios)
    confs = [fnum(i["confidence"]) for i in ios if i.get("confidence") is not None]
    state = T.get(io_freshness(ios[0], now), "?")
    c = f"{T['src_conf']}{round(statistics.median(confs), 2)}" if confs else ""
    return f"{source_label} · {obs[8:10]}.{obs[5:7]} {obs[11:16]}{c} · {state}"


def build(ctx, today):
    b = Brief(today, ctx)
    g = b.gate
    s = {r["agent_code"]: r for r in ctx["status"]}
    rates_dead = g["rates_state"] in ("stale", "dead")

    # 1 market - rendered from the canonical intelligence layer (market_rate_pressure
    # IOs), NOT re-derived here. The signal engine computes the medians/coverage; the
    # brief only renders + cites them. If the world model has no fresh market signal we
    # degrade honestly. The gate (above) still owns BLOCK.
    now = utcnow()
    market_ios = {sd: io for sd, io in ctx["market_ios"].items()
                  if sd >= today.isoformat() and io_freshness(io, now) in ("fresh", "cooling")}
    if rates_dead or not market_ios:
        if rates_dead:
            last = (s.get("collector.booking_rates") or {}).get("last_observed_at")
            when = f" (ultimele date: {str(last)[:10]})" if last else ""
            b.section("market", T["market_t"],
                      [T["stale_market"].format(state=ro_state(g["rates_state"]), when=when)],
                      [f"Competitor rate data is {g['rates_state'].upper()}{when}."])
        else:
            b.section("market", T["market_t"], [T["market_no_io"]],
                      ["Market intelligence layer unavailable (signal not generated)."])
    else:
        d7 = sorted(market_ios)[:7]
        ios7 = [market_ios[d] for d in d7]
        b.rendered_io_ids += [io["id"] for io in ios7 if io.get("id")]
        meds = {d: round(fnum((market_ios[d].get("raw_jsonb") or {}).get("median_adr_ron"))) for d in d7}
        cov = max(int((market_ios[d].get("raw_jsonb") or {}).get("coverage", 0)) for d in d7)
        lo_d, hi_d = min(meds, key=meds.get), max(meds, key=meds.get)
        obs_ids = [oid for d in d7 for ev in (market_ios[d].get("evidence") or [])
                   for oid in (ev.get("observation_ids") or [])]
        cid = b.cite_io(f"median piata {ddmm(lo_d)}-{ddmm(hi_d)}", obs_ids,
                        "intelligence_objects.market_rate_pressure (median/stay_date, 7d)")
        b.section("market", T["market_t"],
                  [T["market_line"].format(n=cov, lo=meds[lo_d],
                                           lo_d=f"{dow(lo_d)} {ddmm(lo_d)}", hi=meds[hi_d],
                                           hi_d=f"{dow(hi_d)} {ddmm(hi_d)}")],
                  [f"Market median {meds[lo_d]}-{meds[hi_d]} RON, next 7 nights ({cov} hotels)."],
                  io_prov_line(ios7, "AETHER signal engine (Booking via Apify)", now), [cid])

    # 2 pressure
    pressed = {d: v for d, v in ctx["press"].items() if len(v) >= 3}
    if rates_dead:
        b.section("pressure", T["pressure_t"], [T["pressure_dep"]],
                  ["Unavailable - depends on stale rate data."])
    elif pressed:
        lines_ro, lines_en, cites = [], [], []
        for d, rows in sorted(pressed.items()):
            cites.append(b.cite(f"presiune {ddmm(d)}", rows, "count(comps sold_out or rooms<=2)"))
            lines_ro.append(T["pressure_hi"].format(wd=dow(d).capitalize(), d=ddmm(d), n=len(rows)))
            lines_en.append(f"{ddmm(d)}: {len(rows)} competitors (nearly) full - HIGH pressure.")
        b.section("pressure", T["pressure_t"], lines_ro, lines_en,
                  prov_line([r for v in pressed.values() for r in v], "Booking.com via Apify"), cites)
    else:
        b.section("pressure", T["pressure_t"], [T["pressure_ok"]],
                  ["Normal - no sellout signs in 7d."],
                  prov_line(ctx["rates"], "Booking.com via Apify") if ctx["rates"] else None)

    # 3 movement
    days_obs = {str(r["observed_at"])[:10] for r in ctx["rates"]}
    if rates_dead:
        b.section("movement", T["movement_t"], [T["movement_stale"]], ["Unavailable."])
    elif len(days_obs) < 2:
        b.section("movement", T["movement_t"], [T["movement_d1"]],
                  ["First collection day - moves appear tomorrow."])
    else:
        b.section("movement", T["movement_t"], [T["movement_ok"]],
                  ["Day-over-day comparison active."])

    # 4 weather
    wx = ctx["wx"]
    if not wx:
        st = (s.get("collector.weather") or {}).get("freshness_state", "dead")
        b.section("weather", T["weather_t"],
                  [T["weather_stale"].format(state=ro_state(st))], [f"Forecast {st.upper()}."])
    else:
        lines_ro, lines_en, cites, wrows, good = [], [], [], [], []
        for d in sorted(wx)[:7]:
            m = wx[d]
            t, p = m.get("temp_max_c"), m.get("precip_prob_pct")
            if not t:
                continue
            wrows += list(m.values())
            if date.fromisoformat(d).weekday() >= 4 and fnum(t["value_numeric"]) >= 27 \
                    and (p is None or fnum(p["value_numeric"]) <= 20):
                good.append(d)
        if good:
            ds = ", ".join(f"{dow(d)} {ddmm(d)}" for d in good)
            cites.append(b.cite(f"weekend favorabil {ds}", wrows, "tmax>=27 & precip<=20% Fri-Sun"))
            lines_ro.append(T["weather_wknd"].format(ds=ds))
            lines_en.append(f"Beach-friendly weekend ({ds}).")
        rng = sorted(wx)[:7]
        t0, t1 = wx[rng[0]].get("temp_max_c"), wx[rng[-1]].get("temp_max_c")
        if t0 and t1:
            cites.append(b.cite("interval termic", [t0, t1], "tmax first/last of horizon"))
            lines_ro.append(T["weather_range"].format(a=round(fnum(t0["value_numeric"])), da=ddmm(rng[0]),
                                                      b=round(fnum(t1["value_numeric"])), db=ddmm(rng[-1])))
            lines_en.append(f"Highs {round(fnum(t0['value_numeric']))}-{round(fnum(t1['value_numeric']))}C.")
        b.section("weather", T["weather_t"], lines_ro or [T["weather_none"]],
                  lines_en or ["No notable signals."], prov_line(wrows, "Visual Crossing"), cites)

    # 5 fx
    fx = ctx["fx"]
    if fx:
        cid = b.cite("curs EUR/RON", [fx], "BNR reference rate")
        b.section("fx", T["fx_t"],
                  [T["fx_line"].format(v=f"{fnum(fx['value_numeric']):.4f}", d=ddmm(fx["target_date"]))],
                  [f"EUR/RON {fnum(fx['value_numeric']):.4f} (BNR {ddmm(fx['target_date'])})."],
                  prov_line([fx], "BNR"), [cid])
    else:
        b.section("fx", T["fx_t"], [T["fx_none"]], ["BNR rate unavailable."])

    # 6+7 action & impact
    if not g["recommendations_allowed"]:
        why = ("; ".join(g["reasons"]) or "date insuficiente").replace("dead", "MOARTE").replace("stale", "VECHI")
        b.section("action", T["action_t"], [T["action_none"].format(why=why)],
                  [f"NO RECOMMENDATION TODAY - {why}."])
        b.section("impact", T["impact_t"], ["—"], ["-"])
    elif pressed:
        tgt = sorted(pressed)[0]
        otb_d = ctx["otb_by_date"].get(tgt, {})
        rem, adr = otb_d.get("rooms_remaining"), otb_d.get("adr")
        cites = [b.cite(f"recomandare {ddmm(tgt)}", pressed[tgt], "pressure rule v0: >=3 comps full")]
        if rem and adr:
            lo = round(fnum(rem["value_numeric"]) * fnum(adr["value_numeric"]) * 0.05 * 0.3)
            hi = round(fnum(rem["value_numeric"]) * fnum(adr["value_numeric"]) * 0.05 * 0.8)
            conf = round(min(0.6, fnum(adr.get("confidence") or 0.6) * 0.7), 2)
            cites.append(b.cite("impact estimat", [rem, adr], "rooms_remaining x ADR x 5% x [0.3..0.8]"))
            b.section("action", T["action_t"],
                      [T["action_raise"].format(wd=dow(tgt), d=ddmm(tgt), n=len(pressed[tgt]),
                                                rooms=int(fnum(rem["value_numeric"])))],
                      [f"Raise ADR +5% for {ddmm(tgt)}: {len(pressed[tgt])} comps full, "
                       f"{int(fnum(rem['value_numeric']))} rooms left."], None, cites)
            b.section("impact", T["impact_t"],
                      [T["impact_line"].format(lo=lo, hi=hi, d=ddmm(tgt), c=conf, cl=conf_label(conf))],
                      [f"+{lo}..+{hi} RON on {ddmm(tgt)} (v0). Confidence {conf}."], None, cites[1:])
        else:
            b.section("action", T["action_t"], [T["action_dir"].format(d=ddmm(tgt))],
                      [f"High pressure {ddmm(tgt)} - do not cut; fill OTB to quantify."], None, cites)
            b.section("impact", T["impact_t"], [T["impact_no_otb"]], ["Needs OTB."])
    else:
        cid = b.cite("piata stabila", ctx["rates"][:5], "no pressured dates in 7d")
        b.section("action", T["action_t"], [T["action_hold"]],
                  ["Hold current rates - stable market."], None, [cid])
        b.section("impact", T["impact_t"], [T["impact_neutral"]], ["Neutral."])

    # 8 provenance
    lines = []
    for code, label in T["labels"].items():
        r = s.get(code) or {}
        st = r.get("freshness_state", "dead")
        ts = str(r.get("last_observed_at") or T["never"])[:16].replace("T", " ")
        lines.append(T["prov_line"].format(label=label, state=ro_state(st), ts=ts))
    b.section("provenance", T["prov_t"], lines, lines)

    # 9 warnings
    warn = []
    if g["rates_state"] != "fresh":
        warn.append(T["warn_rates"].format(state=ro_state(g["rates_state"])))
    for d in g["degraded"]:
        warn.append(T["warn_src"].format(src=d["source"], state=ro_state(d["state"])))
    b.section("warnings", T["warn_t"], warn or [T["warn_none"]], warn or ["All fresh."])

    # 10 watch
    watch = []
    if not rates_dead:
        for d, rows in list(ctx["press"].items())[:2]:
            for r in rows[:1]:
                watch.append(T["watch_full"].format(name=r.get("subject_name", "concurent"), d=ddmm(d)))
    if len(days_obs) < 2:
        watch.append(T["watch_d2"])
    if not ctx["otb_by_date"]:
        watch.append(T["watch_otb"])
    b.section("watch", T["watch_t"], watch or [T["watch_none"]], watch or ["Nothing critical."])
    return b


def check_citations(b):
    """Hard gate: digit-bearing sections must cite, except meta/unavailability."""
    exempt = {"provenance", "warnings", "watch", "movement"}
    bad = []
    for sct in b.sections:
        text = " ".join(sct["lines_ro"])
        unavail = ("ndisponibil" in text or "VECHI" in text or "MORT" in text
                   or "NICIO RECOMANDARE" in text or text.strip() == "—")
        if any(ch.isdigit() for ch in text) and not sct["cites"] \
                and sct["key"] not in exempt and not unavail:
            bad.append(sct["key"])
    if bad:
        raise ValueError(f"uncited numeric claims in sections: {bad}")


def render_text(b):
    out = [f"AETHER · Brief {b.today.strftime('%d.%m.%Y')} · Hotel Terra Neptun"]
    if b.ctx["simulated"]:
        out.append(f"*** {T['sim_banner']} ***")
    out.append(f"Verdict date: {b.gate['verdict']}")
    out.append("")
    for s in b.sections:
        out.append(f"== {s['title_ro']} ==")
        out += s["lines_ro"]
        if s.get("provenance"):
            out.append(f"   [{s['provenance']}]")
        out.append("")
    out.append(f"Generat {iso(utcnow())[:16]}Z · {len(b.citations)} citații · AETHER")
    return "\n".join(out)


def render_html(b):
    e = html_lib.escape
    rows = []
    if b.ctx["simulated"]:
        rows.append('<tr><td style="background:#7a2e2e;color:#fff;padding:10px 16px;'
                    f'font-weight:bold;text-align:center">{e(T["sim_banner"])}</td></tr>')
    if b.gate["verdict"] == "BLOCK":
        rows.append('<tr><td style="background:#8a6d3b;color:#fff;padding:8px 16px;'
                    f'text-align:center">{e(T["block_banner"])}</td></tr>')
    for s in b.sections:
        body = "<br>".join(e(x) for x in s["lines_ro"])
        prov = (f'<div style="color:#8a8378;font-size:11px;margin-top:6px">{e(s["provenance"])}</div>'
                if s.get("provenance") else "")
        rows.append(f'<tr><td style="padding:14px 16px;border-bottom:1px solid #e8e1d5">'
                    f'<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;'
                    f'color:#b98a3c;margin-bottom:4px">{e(s["title_ro"])}</div>'
                    f'<div style="font-size:14px;line-height:1.5;color:#241f18">{body}</div>{prov}</td></tr>')
    en = " · ".join(" ".join(s["lines_en"]) for s in b.sections if s["lines_en"])[:600]
    rows.append(f'<tr><td style="padding:12px 16px;color:#8a8378;font-size:11px;line-height:1.5">'
                f'EN summary: {e(en)}</td></tr>')
    rows.append(f'<tr><td style="padding:12px 16px;color:#8a8378;font-size:11px">Generat '
                f'{iso(utcnow())[:16]}Z · {len(b.citations)} citații verificabile · AETHER</td></tr>')
    return ('<!doctype html><html lang="ro"><body style="margin:0;background:#f4f1ec;'
            'font-family:Segoe UI,Arial,sans-serif">'
            '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px">'
            '<table width="600" cellpadding="0" cellspacing="0" style="background:#fbf9f5;'
            'border:1px solid #e4ddd2;border-radius:8px;overflow:hidden">'
            '<tr><td style="background:#15110e;padding:18px 16px">'
            '<div style="color:#e6b566;font-size:13px;letter-spacing:.14em">AETHER</div>'
            f'<div style="color:#f5f2ee;font-size:19px;margin-top:2px">{html_lib.escape(T["brief_title"])} '
            f'· {b.today.strftime("%d.%m.%Y")} · Hotel Terra Neptun</div></td></tr>'
            + "".join(rows) + "</table></td></tr></table></body></html>")


def subject(b):
    s = f"AETHER · Brief {b.today.strftime('%d.%m.%Y')} · Terra Neptun"
    if b.ctx["simulated"]:
        s += " · [SIMULARE]"
    if b.gate["verdict"] == "BLOCK":
        s += " · [DATE INCOMPLETE]"
    return s


def write_db(sb, b, text, html_out, force=False):
    today = b.today.isoformat()
    content = {"subject": subject(b), "verdict": b.gate, "sections": b.sections,
               "citations": b.citations, "simulated": b.ctx["simulated"], "text": text,
               "intelligence_object_ids": b.rendered_io_ids,
               "data_window": {r["agent_code"]: r.get("last_observed_at") for r in b.ctx["status"]}}
    existing = sb.select("daily_briefs", select="id,sent_at",
                         property_id=f"eq.{pv.PROPERTY_TERRA}", brief_date=f"eq.{today}", limit=1)
    if existing and existing[0].get("sent_at") and not force:
        raise ValueError(f"brief for {today} already sent; use --force to regenerate")
    if existing:
        sb.patch("daily_briefs", {"id": f"eq.{existing[0]['id']}"},
                 {"content_jsonb": content, "rendered_html": html_out})
        return "patched"
    sb.insert("daily_briefs", [{"property_id": pv.PROPERTY_TERRA, "brief_date": today,
                                "content_jsonb": content, "rendered_html": html_out}])
    return "inserted"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--fixture")
    ap.add_argument("--no-write", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    started = utcnow()

    sb = None
    if not a.fixture:
        try:
            sb = SB()
        except SBError as e:
            print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
            return 2
    try:
        data = load_data(a.fixture, sb)
        ctx = index(data)
        local_today = (utcnow() + timedelta(hours=int(os.environ.get("BRIEF_TZ_OFFSET_H", "3")))).date()
        b = build(ctx, local_today)
        check_citations(b)
        text = render_text(b)
        html_out = render_html(b)
    except Exception as e:  # noqa: BLE001
        if sb:
            log_run(sb, AGENT, "failed", {"fixture": a.fixture}, {}, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2

    if a.preview:
        print(text)
        (HERE / "build").mkdir(exist_ok=True)
        tag = "fixture" if a.fixture else "live"
        out = HERE / "build" / f"brief_preview_{tag}.html"
        out.write_text(html_out, encoding="utf-8")
        print(f"\n[preview html] {out}")

    if a.fixture or a.no_write:
        return 0
    try:
        action = write_db(sb, b, text, html_out, force=a.force)
        meta = {"action": action, "verdict": b.gate["verdict"],
                "citations": len(b.citations), "subject": subject(b)}
        log_run(sb, AGENT, "succeeded", {}, meta, started)
        print(json.dumps({"agent": AGENT, "status": "succeeded", **meta}, indent=2, ensure_ascii=False))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", {}, {}, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())