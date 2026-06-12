import json, os, ssl, urllib.request, urllib.error, re, time
import certifi
ctx = ssl.create_default_context(cafile=certifi.where())
APT = os.environ["APIFY_TOKEN"]
SB_URL = os.environ["SUPABASE_URL"].rstrip("/")
SB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ACTOR = "oeiQgfg5fsmIJB7Cn"

# id, full name, city, distinctive tokens that MUST appear in a confident match
props = [
 ("fef41cc5-268f-4de8-b6a3-cdae51a04a56","Arena Regia Hotel Spa Mamaia","Mamaia",["arena","regia"]),
 ("91cdc7a3-c190-4e8e-aa54-b0a07af4c9a5","Hotel Amfiteatru Olimp","Olimp",["amfiteatru"]),
 ("318b3067-a377-4a6b-85e8-1725bbc879d7","Hotel Cocor Spa Neptun","Neptun",["cocor"]),
 ("2dd372ad-76f3-4473-b4d2-f37924bef96a","Hotel Comandor Mamaia","Mamaia",["comandor"]),
 ("5b9824ec-6394-4027-aa40-fc3af0bea94f","Iaki Conference Spa Hotel Mamaia","Mamaia",["iaki"]),
 ("a6077770-4c0e-4c8f-9972-88a19b62e19c","Mera Onyx Hotel Neptun","Neptun",["mera","onyx"]),
 ("97d036ec-9127-48b4-8071-28a6a01e794f","Modern Mamaia Resort","Mamaia",["modern"]),
 ("f6f67644-9486-4d2a-acd4-c0cc441b5fc3","Nayino Resort Eforie Nord","Eforie Nord",["nayino"]),
 ("42dd51f9-ae87-461e-ae59-1f4dc5fad27e","Savoy Hotel Mamaia","Mamaia",["savoy"]),
 ("b5149448-997d-4f78-aee3-1fe2b6f187c6","Splendid Hotel Spa Mamaia","Mamaia",["splendid"]),
 ("3861e12a-2458-4e3a-8a75-804b006e6994","Vega Hotel Mamaia","Mamaia",["vega"]),
 ("8706a3c2-2eba-4b4e-af7e-088469084bb6","Zenith Conference Spa Olimp","Olimp",["zenith"]),
]
def norm(s): return re.sub(r"[^a-z0-9 ]"," ",(s or "").lower())
def canon(url): return (url or "").split("?")[0].split("#")[0]

def search_one(query):
    payload = {"search": query, "maxItems": 1, "language": "en-gb", "currency": "RON",
               "sortBy": "distance_from_search", "rooms": 1, "adults": 2, "children": 0,
               "starsCountFilter":"any","propertyType":"none","minMaxPrice":"0-999999"}
    url = f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items?token={APT}&timeout=120"
    req = urllib.request.Request(url, method="POST",
        headers={"Content-Type":"application/json","User-Agent":"AetherCollector/1.0"},
        data=json.dumps(payload).encode())
    with urllib.request.urlopen(req, timeout=160, context=ctx) as r:
        return json.loads(r.read().decode())

def patch_url(pid, burl):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/scraped_properties?id=eq.{pid}", method="PATCH",
        headers={"apikey":SB_KEY,"Authorization":f"Bearer {SB_KEY}","Content-Type":"application/json","Prefer":"return=minimal"},
        data=json.dumps({"booking_url": burl}).encode())
    urllib.request.urlopen(req, timeout=30, context=ctx).read()

resolved = 0
for pid, name, city, toks in props:
    try:
        items = search_one(name)
        if not items:
            print(f"  [no result]  {name}"); continue
        it = items[0]
        rn = norm(it.get("name"))
        url = canon(it.get("url"))
        ok = any(t in rn for t in toks)
        if ok and url:
            patch_url(pid, url)
            resolved += 1
            print(f"  [OK]  {name:38s} -> {it.get('name')}  | {url.split('/hotel/')[-1]}")
        else:
            print(f"  [REVIEW] {name:35s} -> got '{it.get('name')}' (token miss) {url.split('/hotel/')[-1] if url else ''}")
    except urllib.error.HTTPError as e:
        print(f"  [HTTP {e.code}] {name}")
    except Exception as e:
        print(f"  [ERR] {name}: {str(e)[:80]}")
    time.sleep(1)
print(f"\nRESOLVED {resolved}/12 booking_urls (written to scraped_properties)")