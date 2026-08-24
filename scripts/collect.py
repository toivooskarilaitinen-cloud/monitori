from __future__ import annotations
import json, math, os, statistics, zipfile, io
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
import requests, feedparser

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OBS = DATA / "observations"
HISTORY = DATA / "history"
METHOD_VERSION = "v0.1"
UA = "VAIMEA-MONITORI/0.1 (+https://vaimeatapa.fi/lab/)"

for p in (DATA, OBS, HISTORY):
    p.mkdir(parents=True, exist_ok=True)

def get_json(url, params=None, headers=None, timeout=25):
    h = {"User-Agent": UA}
    if headers: h.update(headers)
    r = requests.get(url, params=params, headers=h, timeout=timeout)
    r.raise_for_status()
    return r.json()

def attention_google_trends():
    # Public Trending Now RSS fallback. The official Trends API remains limited-access alpha.
    url = "https://trends.google.com/trending/rss?geo=US"
    feed = feedparser.parse(url, agent=UA)
    if getattr(feed, "bozo", False) and not feed.entries:
        raise RuntimeError("Google Trends RSS unavailable")
    entries = feed.entries[:25]
    traffic = []
    for e in entries:
        raw = None
        for key in ("ht_approx_traffic", "approx_traffic"):
            if key in e:
                raw = e[key]
        if raw:
            digits = "".join(ch for ch in str(raw) if ch.isdigit())
            if digits:
                traffic.append(int(digits))
    # A stable raw signal: number of current trending entries + their reported traffic if present.
    value = sum(traffic) if traffic else len(entries)
    return {
        "status":"ok","provider":"Google Trends Trending Now RSS",
        "value":float(value),
        "display_value":f"{len(entries)} trends",
        "detail":"Trending Now; public RSS fallback"
    }

def knowledge_wikipedia():
    now = datetime.now(timezone.utc)
    start = now.isoformat().replace("+00:00","Z")
    end = (now - timedelta(hours=1)).isoformat().replace("+00:00","Z")
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action":"query","format":"json","list":"recentchanges",
        "rctype":"edit|new","rcprop":"timestamp","rclimit":"500",
        "rcstart":start,"rcend":end,"rcdir":"older"
    }
    count = 0
    loops = 0
    while True:
        data = get_json(url, params=params)
        count += len(data.get("query",{}).get("recentchanges",[]))
        loops += 1
        cont = data.get("continue")
        if not cont or loops >= 12:
            break
        params.update(cont)
    return {
        "status":"ok","provider":"Wikimedia MediaWiki API",
        "value":float(count),"display_value":f"{count} edits/h",
        "detail":"English Wikipedia recent changes, last hour"
    }

def events_gdelt():
    # Lightweight proxy: metadata size of latest GKG update, avoiding downloading a large archive.
    url = "https://data.gdeltproject.org/gdeltv2/lastupdate.txt"
    r = requests.get(url, headers={"User-Agent":UA}, timeout=25)
    r.raise_for_status()
    rows = [line.strip().split() for line in r.text.splitlines() if line.strip()]
    gkg = None
    for row in rows:
        if len(row) >= 3 and ".gkg.csv.zip" in row[2]:
            gkg = row
            break
    if not gkg:
        raise RuntimeError("GDELT GKG metadata not found")
    size_bytes = int(gkg[0])
    return {
        "status":"ok","provider":"GDELT 2.0",
        "value":float(size_bytes),
        "display_value":f"{size_bytes/1_000_000:.1f} MB",
        "detail":"Latest 15-minute GKG archive size; experimental news-volume proxy"
    }

def activity_cloudflare():
    token = os.getenv("CLOUDFLARE_API_TOKEN")
    if not token:
        return {
            "status":"unavailable","provider":"Cloudflare Radar API",
            "value":None,"detail":"CLOUDFLARE_API_TOKEN not configured"
        }
    url = "https://api.cloudflare.com/client/v4/radar/http/timeseries"
    params = {"dateRange":"1d","aggInterval":"1h","format":"JSON"}
    data = get_json(url, params=params, headers={"Authorization":f"Bearer {token}"})
    result = data.get("result",{})
    series = result.get("serie_0") or result.get("series") or {}
    vals = []
    if isinstance(series, dict):
        vals = series.get("values",[]) or []
    elif isinstance(series, list):
        vals = series
    nums = [float(x) for x in vals if isinstance(x,(int,float,str)) and str(x).replace(".","",1).isdigit()]
    if not nums:
        # Preserve API success as metadata but avoid inventing a traffic value.
        return {
            "status":"unavailable","provider":"Cloudflare Radar API",
            "value":None,"detail":"Radar response received; timeseries shape needs calibration"
        }
    value = nums[-1]
    return {
        "status":"ok","provider":"Cloudflare Radar API",
        "value":value,"display_value":f"{value:.2f}",
        "detail":"Global HTTP request timeseries, latest hourly point"
    }

def discussion_hn():
    max_id = get_json("https://hacker-news.firebaseio.com/v0/maxitem.json")
    return {
        "status":"ok","provider":"Hacker News official Firebase API",
        "value":float(max_id),"display_value":str(max_id),
        "detail":"Max item ID; rate is derived from change between observations"
    }

def safe(fn):
    try:
        return fn()
    except Exception as e:
        return {"status":"unavailable","value":None,"provider":fn.__name__,"detail":str(e)[:180]}

def read_history():
    rows = []
    for p in sorted(HISTORY.glob("*.json")):
        try:
            rows.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            pass
    return rows

def raw_value(snapshot, sensor):
    s = snapshot.get("sensors",{}).get(sensor,{})
    v = s.get("value")
    return float(v) if isinstance(v,(int,float)) else None

def robust_z(current, vals):
    vals = [float(v) for v in vals if v is not None]
    if current is None or len(vals) < 7:
        return None
    med = statistics.median(vals)
    mad = statistics.median([abs(x-med) for x in vals])
    if mad == 0:
        sd = statistics.pstdev(vals)
        return 0.0 if sd == 0 else (current-statistics.mean(vals))/sd
    return 0.6745 * (current-med)/mad

def score_from_z(z, absolute=False):
    if z is None: return None
    x = abs(z) if absolute else z
    if absolute:
        return max(0,min(100,100*(1-math.exp(-abs(x)/2.2))))
    return max(0,min(100,50 + 18*x))

def mean_available(values):
    vals=[v for v in values if v is not None]
    return sum(vals)/len(vals) if vals else None

now = datetime.now(timezone.utc)
date = now.date().isoformat()
hour_key = now.strftime("%Y-%m-%dT%H")

sensors = {
    "google_trends": safe(attention_google_trends),
    "wikipedia": safe(knowledge_wikipedia),
    "news": safe(events_gdelt),
    "internet_traffic": safe(activity_cloudflare),
    "conversation": safe(discussion_hn),
}

history = read_history()
sensor_keys = list(sensors)
zs = {}
for key in sensor_keys:
    current = sensors[key].get("value")
    past = [raw_value(h,key) for h in history[-90:]]
    # HN maxitem is cumulative; use rate via difference from previous observation if possible.
    if key == "conversation" and current is not None and history:
        prev = raw_value(history[-1], key)
        if prev is not None:
            sensors[key]["raw_cumulative"] = current
            sensors[key]["value"] = max(0.0, current-prev)
            sensors[key]["display_value"] = f"+{int(sensors[key]['value'])} items"
            current = sensors[key]["value"]
            past_rates=[]
            for i in range(1,len(history)):
                a=raw_value(history[i],key); b=raw_value(history[i-1],key)
                if a is not None and b is not None:
                    past_rates.append(max(0,a-b))
            past=past_rates[-90:]
    zs[key] = robust_z(current,past)

attention = score_from_z(zs.get("google_trends"))
knowledge = score_from_z(zs.get("wikipedia"))
events = score_from_z(zs.get("news"))
activity_sensor = score_from_z(zs.get("internet_traffic"))
discussion = score_from_z(zs.get("conversation"))

activity = mean_available([activity_sensor, knowledge, discussion, events])
volatility = mean_available([score_from_z(z,absolute=True) for z in zs.values()])
tension = mean_available([events, discussion, attention])
curiosity = mean_available([knowledge, attention])
strangeness_parts = [score_from_z(z,absolute=True) for z in zs.values()]
strangeness = mean_available(strangeness_parts)

def metric(value, prev=None):
    return {"value": value, "change": None if value is None or prev is None else value-prev}

prev = history[-1] if history else None
prev_metrics = prev.get("metrics",{}) if prev else {}
metrics_values = {
    "activity":activity,
    "volatility":volatility,
    "attention":attention,
    "tension":tension,
    "curiosity":curiosity,
    "strangeness":strangeness,
}
metrics = {k:metric(v, prev_metrics.get(k,{}).get("value")) for k,v in metrics_values.items()}

conditions=[]
if len(history) < 7:
    conditions=["COLLECTING BASELINE"]
else:
    if activity is not None: conditions.append("ACTIVE" if activity>=60 else "QUIET" if activity<=40 else "NORMAL")
    if attention is not None and attention>=65: conditions.append("FOCUSED")
    if volatility is not None and volatility>=65: conditions.append("VOLATILE")
    if strangeness is not None: conditions.append("UNUSUAL" if strangeness>=65 else "NOT UNUSUAL")

strange_hist=[h.get("metrics",{}).get("strangeness",{}).get("value") for h in history]
strange_hist=[x for x in strange_hist if isinstance(x,(int,float))]
def avg(days):
    vals=strange_hist[-days:]
    return sum(vals)/len(vals) if vals else None

summary={
    "change_24h": metrics["strangeness"]["change"],
    "avg_7d":avg(7),
    "avg_30d":avg(30)
}

snapshot={
    "date":date,
    "generated_at":now.isoformat(),
    "method_version":METHOD_VERSION,
    "baseline":{"observations":len(history),"window_days":90,"method":"rolling robust median/MAD; provisional under 30 days"},
    "metrics":metrics,
    "conditions":conditions,
    "summary":summary,
    "sensors":sensors,
    "sensor_z":zs,
}

payload=json.dumps(snapshot,ensure_ascii=False,indent=2)
(DATA/"latest.json").write_text(payload,encoding="utf-8")
(OBS/f"{hour_key.replace(':','-')}.json").write_text(payload,encoding="utf-8")
(HISTORY/f"{date}.json").write_text(payload,encoding="utf-8")
print(payload)
