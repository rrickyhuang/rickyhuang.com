#!/usr/bin/env python3
"""
Tests for the privacy scrub in prep_photos.py: clean_exif() decides what metadata is kept,
and verify() is the last guard that stops a file with location data being published.

Needs Pillow (pip install pillow); skipped when it is not installed, so the stdlib-only
run in the deploy workflow is unaffected. That also means CI does not run them: run them
by hand after changing prep_photos.py. Revisit (pinned Pillow install in deploy.yml) once
real photos go on the site; see the Photos section of the README. Run from the repo root with

    python -m unittest discover -s tools -p "test_*.py"
"""
import tempfile
import unittest
from pathlib import Path

try:
    from PIL import Image
    import prep_photos
except ImportError:                      # Pillow not installed
    Image = prep_photos = None

GPS_IFD, EXIF_IFD = 0x8825, 0x8769
XMP = (b'<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">'
       b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')


def leaky_exif():
    """EXIF like a camera writes it: keep-list tags plus GPS, MakerNote, serials and owner."""
    ex = Image.Exif()
    ex[0x010F], ex[0x0110] = "TestCam", "Model 1"                     # Make, Model (kept)
    ex[0x013B] = "Some Owner"                                         # Artist (replaced)
    ex.get_ifd(EXIF_IFD).update({
        0x829A: 0.01, 0x829D: 2.8, 0x8827: 100, 0x9003: "2026:10:01 12:00:00",   # exposure, f, ISO, date (kept)
        0x9204: 0.0, 0x920A: 35.0,                                    # exposure bias, focal length (kept)
        0xA434: "TestLens",                                           # LensModel (kept)
        0x927C: b"maker-secret",                                      # MakerNote
        0xA431: "BODY-SERIAL-1", 0xA432: "OWNER-NAME-1",              # body serial, camera owner name
        0xA435: "LENS-SERIAL-1",                                      # lens serial
    })
    ex.get_ifd(GPS_IFD).update({1: "N", 2: (49.0, 16.0, 0.0), 3: "W", 4: (123.0, 7.0, 0.0)})
    return ex


@unittest.skipIf(prep_photos is None, "Pillow is not installed")
class PrivacyScrub(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.img = Image.new("RGB", (32, 24), (90, 120, 80))

    def save(self, name, exif, **kw):
        path = self.dir / name
        self.img.save(path, exif=exif.tobytes(), **kw)
        return path

    def cleaned(self, name, **kw):
        # saved the way main() does it
        return self.save(name, prep_photos.clean_exif(leaky_exif(), 2026), icc_profile=prep_photos.SRGB_BYTES, **kw)

    def test_leaky_original_is_rejected(self):
        with self.assertRaises(SystemExit) as cm:
            prep_photos.verify(self.save("orig.jpg", leaky_exif()))
        msg = str(cm.exception)
        for found in ("GPS", "0x927c", "0xa431", "0xa432", "0xa435"):
            self.assertIn(found, msg)

    def test_each_leak_is_caught_on_its_own(self):
        for tag in (0x927C, 0xA431, 0xA432, 0xA435):
            ex = Image.Exif()
            ex.get_ifd(EXIF_IFD)[tag] = b"x" if tag == 0x927C else "x"
            with self.subTest(tag=hex(tag)), self.assertRaises(SystemExit):
                prep_photos.verify(self.save(f"t{tag:x}.jpg", ex))
        ex = Image.Exif()
        ex.get_ifd(GPS_IFD).update({1: "N", 2: (1.0, 2.0, 3.0)})
        with self.subTest("gps"), self.assertRaises(SystemExit):
            prep_photos.verify(self.save("gps.jpg", ex))

    def test_xmp_is_rejected(self):
        path = self.save("xmp.jpg", Image.Exif(), xmp=XMP)
        with self.assertRaises(SystemExit):
            prep_photos.verify(path)

    def test_cleaned_jpeg_passes_and_keeps_only_the_allowed_tags(self):
        path = self.cleaned("clean.jpg")
        prep_photos.verify(path)                                      # does not exit
        with Image.open(path) as im:
            ex = im.getexif()
            self.assertEqual((ex[0x010F], ex[0x0110]), ("TestCam", "Model 1"))
            self.assertEqual(ex[0x013B], prep_photos.OWNER)           # Artist is the site owner, not the camera's
            self.assertIn("2026", ex[0x8298])                         # Copyright, with the year taken
            self.assertEqual(set(ex.get_ifd(EXIF_IFD)), set(prep_photos.KEEP_EXIF))
            self.assertEqual(ex.get_ifd(EXIF_IFD)[0xA434], "TestLens")
            self.assertEqual(dict(ex.get_ifd(GPS_IFD)), {})

    def test_cleaned_webp_passes(self):
        try:
            path = self.cleaned("clean.webp")
        except (OSError, KeyError, ValueError):
            self.skipTest("this Pillow build cannot write WebP")
        prep_photos.verify(path)

    def test_clean_exif_drops_everything_not_on_the_keep_list(self):
        ex = prep_photos.clean_exif(leaky_exif(), 2026)
        self.assertEqual({t for t in ex if t not in (GPS_IFD, EXIF_IFD)}, {0x010F, 0x0110, 0x013B, 0x8298})
        self.assertEqual(dict(ex.get_ifd(GPS_IFD)), {})
        for tag in (0x927C, 0xA431, 0xA432, 0xA435):
            self.assertNotIn(tag, ex.get_ifd(EXIF_IFD))


if __name__ == "__main__":
    unittest.main()
