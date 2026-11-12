"""Turns the extractor's output back into a Photon JSON dump (zstd), applying
the same exclusions as build-index and dropping translations Photon's default
import ignores."""
import sys, json, itertools, zstandard
from multiprocessing import Pool

LANGS = {"en", "de", "fr", "it"}
def keep_key(k):
    parts = k.split(":")
    return len(parts) == 1 or parts[-1] in LANGS

def convert(lines):
    out = []
    for line in lines:
        p = json.loads(line)
        kind = (p["osm_key"], p["osm_value"])
        if kind in (("waterway", "canal"), ("water", "pond")): continue
        if kind == ("waterway", "river") and p["object_type"] != "R": continue
        p["name"] = {k: v for k, v in p["name"].items() if keep_key(k)}
        if not p["name"]: continue
        if "address" in p:
            p["address"] = {k: v for k, v in p["address"].items() if keep_key(k)}
        p["place_id"] = f'{p["object_type"]}{p["object_id"]}.{p["osm_key"]}.{p["osm_value"]}'
        p["categories"] = [f'osm.{kind[0]}.{kind[1]}']
        out.append(json.dumps({"type": "Place", "content": [p]}, ensure_ascii=False, separators=(",", ":")))
    return "\n".join(out) + "\n" if out else ""

def batches(f, n=5000):
    while True:
        b = list(itertools.islice(f, n))
        if not b: return
        yield b

if __name__ == "__main__":
    src, countries, dst = sys.argv[1:4]
    cctx = zstandard.ZstdCompressor(level=6, threads=2)
    with open(src, encoding="utf-8") as f, open(dst, "wb") as raw, cctx.stream_writer(raw) as w:
        w.write((json.dumps({"type": "NominatimDumpFile", "content": {"version": "0.1.0", "generator": "photon", "database_version": "1.0.0-4", "features": {"sorted_by_country": True, "has_addresslines": False}}}) + "\n").encode())
        w.write((json.dumps({"type": "CountryInfo", "content": json.load(open(countries))}, ensure_ascii=False) + "\n").encode())
        with Pool(4) as pool:
            for chunk in pool.imap(convert, batches(f), chunksize=1):
                w.write(chunk.encode())
