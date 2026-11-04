#!/usr/bin/env python3
"""
fetch_letterboxd.py - save your latest Letterboxd diary entries to film.json.

  python3 fetch_letterboxd.py                       # user rkyhuang -> ./film.json
  python3 fetch_letterboxd.py --user rkyhuang --out site/film.json --limit 5

Reads the public RSS feed (https://letterboxd.com/<user>/rss/). Standard library only.
Keeps just: film title, year, your star rating, liked, rewatch, the date you watched it,
and the link to the film. It does NOT keep review text, posters, or TMDB ids.
(Reviews and posters are in the feed if you ever want them: see the description field.)
"""
import argparse, json, sys, urllib.request
import xml.etree.ElementTree as ET

NS = {"lb": "https://letterboxd.com", "tmdb": "https://themoviedb.org"}


def parse(xml_bytes, limit):
    root = ET.fromstring(xml_bytes)
    out = []
    for it in root.iterfind("./channel/item"):
        title = it.findtext("lb:filmTitle", namespaces=NS)
        if not title:                       # lists, etc. have no film title
            continue
        rating = it.findtext("lb:memberRating", namespaces=NS)
        out.append({
            "title": title,
            "year": it.findtext("lb:filmYear", namespaces=NS) or "",
            "rating": float(rating) if rating else None,
            "liked": it.findtext("lb:memberLike", namespaces=NS) == "Yes",
            "rewatch": it.findtext("lb:rewatch", namespaces=NS) == "Yes",
            "watched": it.findtext("lb:watchedDate", namespaces=NS) or "",
            "url": (it.findtext("link") or "").strip(),
        })
    out.sort(key=lambda e: e["watched"], reverse=True)      # newest watched first
    return out[:limit]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--user", default="rkyhuang")
    ap.add_argument("--out", default="film.json")
    ap.add_argument("--limit", type=int, default=5)
    a = ap.parse_args()
    req = urllib.request.Request(f"https://letterboxd.com/{a.user}/rss/",
                                 headers={"User-Agent": f"personal-site-film-feed ({a.user}.github.io)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            films = parse(r.read(), a.limit)
    except Exception as e:                  # keep the old film.json if Letterboxd is down
        sys.exit(f"Could not fetch the feed ({e}); left {a.out} unchanged.")
    if not films:
        sys.exit("Feed had no film entries; left the file unchanged.")
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(films, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"{len(films)} films -> {a.out}; latest: {films[0]['title']} ({films[0]['year']})")


if __name__ == "__main__":
    main()
