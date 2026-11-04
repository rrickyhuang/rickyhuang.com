#!/usr/bin/env python3
"""
prep_photos.py - turn Darktable "web master" exports into website-ready photos.

  python3 prep_photos.py                      # uses ./photos-src  ->  ./site/photos
  python3 prep_photos.py --src D:/Exports/web --out site
  python3 prep_photos.py --avif --force       # also make AVIF, redo everything

What it does for every JPEG/PNG/TIFF in --src:
  * resizes to 640 / 1280 / 2000 px on the long edge (never upscales)
  * writes JPEG (fallback) + WebP (and AVIF with --avif) at each size
  * converts to sRGB and embeds a tiny sRGB profile
  * REMOVES location (GPS), MakerNote, serial numbers, owner name, XMP, thumbnails
  * KEEPS only: camera, lens, exposure, date taken
  * WRITES your name + copyright into every file
  * makes a tiny blurred placeholder for fast loading
  * writes <out>/photos.json for the site, merging titles/places/alt text from
    photos.meta.json (new photos get a stub entry there for you to fill in)
  * re-checks every output file and stops loudly if any location data survived

Needs:  pip install pillow          (Pillow 10+ for WebP, 11.3+/pillow-avif for AVIF)
"""
import argparse, base64, io, json, re, sys, datetime
from pathlib import Path
from PIL import Image, ImageCms, ImageFilter, ImageOps

# ---- edit these ------------------------------------------------------------
OWNER      = "Ricky Huang"
COPYRIGHT  = "Copyright {year} Ricky Huang. All rights reserved."   # plain ASCII: Exif can't store the (c) symbol
SIZES      = (640, 1280, 2000)          # long edge, px
JPEG_Q, WEBP_Q, AVIF_Q = 82, 80, 58
# ----------------------------------------------------------------------------

EXIF_IFD, GPS_IFD = 0x8769, 0x8825
KEEP_BASE = {0x010F: "Make", 0x0110: "Model"}                 # Artist/Copyright added below
KEEP_EXIF = {0x829A: "ExposureTime", 0x829D: "FNumber", 0x8827: "ISO",
             0x9003: "DateTimeOriginal", 0x9204: "ExposureBias",
             0x920A: "FocalLength", 0xA434: "LensModel"}
SRC_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
SRGB_BYTES = SRGB.tobytes()


def slugify(stem):
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def stub_from_name(stem, exif_date):
    """Your naming convention is YYYY-MM-DD_EventName_####."""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})_(.+?)(?:_\d+)?$", stem)
    date, place = "", ""
    if m:
        date = m.group(1)
        place = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", m.group(2)).replace("-", " ").replace("_", " ")
    elif exif_date:
        date = exif_date
    return {"title": "", "place": place, "date": date, "alt": "", "series": ""}


def clean_exif(src_exif, year):
    ex = Image.Exif()
    for tag in KEEP_BASE:
        if tag in src_exif:
            ex[tag] = src_exif[tag]
    kept = {t: v for t, v in src_exif.get_ifd(EXIF_IFD).items() if t in KEEP_EXIF}
    if kept:
        ex.get_ifd(EXIF_IFD).update(kept)
    ex[0x013B] = OWNER                                                        # Artist
    ex[0x8298] = COPYRIGHT.format(year=year)                                  # Copyright (year the photo was taken)
    return ex


def exif_date(src_exif):
    v = src_exif.get_ifd(EXIF_IFD).get(0x9003)
    return v[:10].replace(":", "-") if isinstance(v, str) and len(v) >= 10 else ""


def to_srgb(img):
    icc = img.info.get("icc_profile")
    if icc:
        try:
            prof = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            if "srgb" not in (ImageCms.getProfileDescription(prof) or "").lower():
                img = ImageCms.profileToProfile(img, prof, SRGB, outputMode="RGB",
                                                renderingIntent=ImageCms.Intent.PERCEPTUAL)
        except Exception as e:
            print(f"   ! could not read embedded profile ({e}); assuming sRGB")
    return img.convert("RGB")


def verify(path):
    """Fail loudly if location or other private data is still in the file."""
    with Image.open(path) as im:
        ex = im.getexif()
        bad = []
        if GPS_IFD in ex or ex.get_ifd(GPS_IFD):
            bad.append("GPS")
        for t in (0x927C, 0xA431, 0xA432, 0xA435):    # MakerNote, body serial, owner, lens serial
            if t in ex.get_ifd(EXIF_IFD):
                bad.append(f"exif tag {hex(t)}")
        if any(k.lower().startswith(("xmp", "xml")) for k in im.info):
            bad.append("XMP")
    raw = Path(path).read_bytes()
    for needle in (b"<x:xmpmeta", b"<rdf:RDF", b"http://ns.adobe.com/xap", b"Photoshop 3.0"):   # XMP / IPTC blocks
        if needle in raw:
            bad.append(needle.decode(errors="ignore"))
    if bad:
        sys.exit(f"STOP: {path} still contains {bad}. Nothing was published.")


def lqip(img):
    t = img.copy()
    t.thumbnail((24, 24))
    buf = io.BytesIO()
    t.save(buf, "JPEG", quality=40)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default="photos-src", help="folder of Darktable web-master exports")
    ap.add_argument("--out", default="site", help="site folder; images go to <out>/photos")
    ap.add_argument("--meta", default="photos.meta.json", help="hand-edited titles/places/alt text")
    ap.add_argument("--avif", action="store_true", help="also write AVIF")
    ap.add_argument("--no-sharpen", action="store_true", help="skip the mild output sharpening")
    ap.add_argument("--force", action="store_true", help="rebuild even if up to date")
    a = ap.parse_args()

    src, out = Path(a.src), Path(a.out)
    pdir = out / "photos"
    pdir.mkdir(parents=True, exist_ok=True)
    meta_path = Path(a.meta)
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in SRC_EXT)
    if not files:
        sys.exit(f"No images found in {src}")

    fmts = [("jpg", "JPEG", JPEG_Q), ("webp", "WEBP", WEBP_Q)] + ([("avif", "AVIF", AVIF_Q)] if a.avif else [])
    entries, new_stubs = [], []

    for f in files:
        slug = slugify(f.stem)
        with Image.open(f) as im0:
            im0.load()
            src_exif = im0.getexif()
            taken = exif_date(src_exif)
            img = to_srgb(ImageOps.exif_transpose(im0))
        W, H = img.size
        long_edge = max(W, H)
        widths = sorted({s for s in SIZES if s < long_edge} | {min(long_edge, SIZES[-1])})
        year = (taken or str(datetime.date.today()))[:4]
        exif_bytes = clean_exif(src_exif, year).tobytes()

        biggest = pdir / f"{slug}-{widths[-1]}.jpg"
        fresh = biggest.exists() and biggest.stat().st_mtime >= f.stat().st_mtime
        files_out = {k: {} for k, _, _ in fmts}
        for w in widths:
            for ext, name, q in fmts:
                files_out[ext][w] = f"photos/{slug}-{w}.{ext}"
        if a.force or not fresh:
            print(f"-> {f.name}  ({W}x{H})  sizes {widths}")
            for w in widths:
                scale = w / long_edge
                im = img if w == long_edge else img.resize((round(W * scale), round(H * scale)), Image.LANCZOS)
                if w < long_edge and not a.no_sharpen:
                    im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=35, threshold=2))
                im.info = {}                          # make sure nothing is inherited
                for ext, name, q in fmts:
                    path = pdir / f"{slug}-{w}.{ext}"
                    kw = dict(quality=q, exif=exif_bytes, icc_profile=SRGB_BYTES)
                    if name == "JPEG":
                        kw.update(optimize=True, progressive=True)
                    elif name == "WEBP":
                        kw.update(method=6)
                    elif name == "AVIF":
                        kw.update(speed=6)
                    im.save(path, name, **kw)
                    verify(path)
        else:
            print(f"   {f.name}: up to date")

        if slug not in meta:
            meta[slug] = stub_from_name(f.stem, taken)
            new_stubs.append(slug)
        m = meta[slug]
        entries.append({
            "slug": slug, "title": m.get("title", ""), "place": m.get("place", ""),
            "date": m.get("date", ""), "alt": m.get("alt", ""), "series": m.get("series", ""),
            "width": W, "height": H, "lqip": lqip(img),
            "files": files_out,
            "srcset": {ext: ", ".join(f"{files_out[ext][w]} {w}w" for w in widths) for ext, _, _ in fmts},
            "sizes": "(min-width: 900px) 60vw, 100vw",
        })

    entries.sort(key=lambda e: (e["date"], e["slug"]), reverse=True)
    (out / "photos.json").write_text(json.dumps(entries, indent=1))
    meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False))

    print(f"\n{len(entries)} photos -> {pdir}   (list: {out/'photos.json'})")
    if new_stubs:
        print(f"New in {meta_path}: fill in title / place / alt for:\n  " + "\n  ".join(new_stubs))
    missing = [e["slug"] for e in entries if not e["alt"] or not e["title"]]
    if missing and not new_stubs:
        print(f"Still missing a title or alt text: {len(missing)} photo(s)")


if __name__ == "__main__":
    main()
