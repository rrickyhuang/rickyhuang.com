#!/usr/bin/env python3
"""
Tests for fetch_letterboxd.parse(). Standard library only; run from the repo root with

    python -m unittest discover -s tools -p "test_*.py"

The deploy workflow runs this before fetching, so a change in how parse() reads the
feed shows up in CI instead of silently leaving an old film.json in place.
"""
import unittest

import fetch_letterboxd

LB = "https://letterboxd.com"

# One rated + liked film, one unrated film (newest), one list entry (no filmTitle),
# and one rewatch with no watchedDate (must sort last).
FEED = f"""<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:letterboxd="{LB}" xmlns:tmdb="https://themoviedb.org">
  <channel>
    <title>Letterboxd - test</title>
    <item>
      <title>Alpha, 2024 - ★★★★½</title>
      <link>https://letterboxd.com/test/film/alpha/</link>
      <letterboxd:watchedDate>2026-10-01</letterboxd:watchedDate>
      <letterboxd:rewatch>No</letterboxd:rewatch>
      <letterboxd:filmTitle>Alpha</letterboxd:filmTitle>
      <letterboxd:filmYear>2024</letterboxd:filmYear>
      <letterboxd:memberRating>4.5</letterboxd:memberRating>
      <letterboxd:memberLike>Yes</letterboxd:memberLike>
    </item>
    <item>
      <title>Beta, 2025</title>
      <link>
        https://letterboxd.com/test/film/beta/
      </link>
      <letterboxd:watchedDate>2026-10-05</letterboxd:watchedDate>
      <letterboxd:rewatch>No</letterboxd:rewatch>
      <letterboxd:filmTitle>Beta</letterboxd:filmTitle>
      <letterboxd:filmYear>2025</letterboxd:filmYear>
    </item>
    <item>
      <title>My list</title>
      <link>https://letterboxd.com/test/list/my-list/</link>
    </item>
    <item>
      <title>Gamma, 2023</title>
      <link>https://letterboxd.com/test/film/gamma/</link>
      <letterboxd:rewatch>Yes</letterboxd:rewatch>
      <letterboxd:filmTitle>Gamma</letterboxd:filmTitle>
      <letterboxd:filmYear>2023</letterboxd:filmYear>
      <letterboxd:memberRating>3.0</letterboxd:memberRating>
      <letterboxd:memberLike>No</letterboxd:memberLike>
    </item>
  </channel>
</rss>
""".encode("utf-8")


class ParseTests(unittest.TestCase):
    def setUp(self):
        self.films = fetch_letterboxd.parse(FEED, 10)
        self.by_title = {f["title"]: f for f in self.films}

    def test_list_entries_without_film_title_are_skipped(self):
        self.assertEqual(sorted(self.by_title), ["Alpha", "Beta", "Gamma"])

    def test_sorted_newest_watched_first_and_missing_date_last(self):
        self.assertEqual([f["title"] for f in self.films], ["Beta", "Alpha", "Gamma"])
        self.assertEqual(self.by_title["Gamma"]["watched"], "")

    def test_rating_is_a_float_or_none(self):
        self.assertEqual(self.by_title["Alpha"]["rating"], 4.5)
        self.assertIsInstance(self.by_title["Alpha"]["rating"], float)
        self.assertIsNone(self.by_title["Beta"]["rating"])

    def test_year_stays_a_string(self):
        self.assertEqual(self.by_title["Alpha"]["year"], "2024")
        self.assertIsInstance(self.by_title["Alpha"]["year"], str)

    def test_liked_and_rewatch_flags(self):
        self.assertTrue(self.by_title["Alpha"]["liked"])
        self.assertFalse(self.by_title["Beta"]["liked"])      # no memberLike element
        self.assertFalse(self.by_title["Gamma"]["liked"])     # memberLike = No
        self.assertTrue(self.by_title["Gamma"]["rewatch"])
        self.assertFalse(self.by_title["Alpha"]["rewatch"])

    def test_url_is_stripped(self):
        self.assertEqual(self.by_title["Beta"]["url"], "https://letterboxd.com/test/film/beta/")

    def test_limit_keeps_the_newest(self):
        self.assertEqual([f["title"] for f in fetch_letterboxd.parse(FEED, 2)], ["Beta", "Alpha"])

    def test_changed_namespace_yields_no_films(self):
        # If Letterboxd moves its namespace the parser finds nothing; main() then exits
        # "Feed had no film entries" and the workflow keeps the committed film.json.
        moved = FEED.replace(LB.encode(), b"https://example.invalid/letterboxd")
        self.assertEqual(fetch_letterboxd.parse(moved, 10), [])


if __name__ == "__main__":
    unittest.main()
