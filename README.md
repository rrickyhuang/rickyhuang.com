# rickyhuang.com

Personal landing page. Plain static files in `site/`, published with GitHub Pages.

    site/index.html       the page (styles.css, app.js, assets/)
    site/lines.js         what the hiker says (edit the lists freely)
    site/hiker.css, hiker.js   the hiker's bubble/animation CSS and helpers, shared by index.html and 404.html
                          (404.html loads them by root-relative path because it is served from any depth)
    site/404.html         "lost in the fog" page, served automatically for any missing URL
    site/film.json        latest Letterboxd logs, refreshed daily by the workflow
    site/og-image.jpg     link-preview image (1200x630)
    tools/prep_photos.py  turns Darktable exports into web-ready photos (optional)
    tools/fetch_letterboxd.py  writes site/film.json from the Letterboxd RSS feed

## Preview locally

    python3 -m http.server -d site 8000      # then open http://localhost:8000

## Deploy

Repo Settings > Pages > Source: **GitHub Actions**, custom domain `rickyhuang.com`.
`.github/workflows/deploy.yml` publishes `site/` on every push to `main` and once a day
(refreshing `film.json` first). Commits made by a workflow do not trigger Pages builds,
so the refreshed `film.json` is published but never committed back: the copy in git is only
the fallback for when Letterboxd is unreachable, and the page shows no film bubble if
`film.json` can't be loaded at all.

## Photos

`tools/prep_photos.py` is the start of a photo gallery pipeline (a gallery is planned), which is why it
makes three sizes, JPEG/WebP (optional AVIF), blurred placeholders and a `photos.json` rather than just
a thumbnail. It also strips location data and then verifies that none survived, which is the part that
matters for privacy even before a gallery exists.

Workflow: export from Darktable (sRGB JPEG, 2400 px long edge, geo tags off), then run
`python3 tools/prep_photos.py --src <export folder> --out site` from the repo root. It writes:

    site/photos/          resized images
    site/photos.json      list for the site (title, place, alt, sizes, srcset, placeholder)
    photos.meta.json      in the folder you run it from (repo root); hand-edit titles, places and
                          alt text here, new photos get a stub entry. Commit it: it is the source
                          of that text, and the next run merges it into photos.json.

Nothing reads `photos.json` yet. Until the gallery exists, the hiker's photo bubbles stay off while
`PHOTOS` in `site/app.js` is empty; to try one, add entries to `PHOTOS` by hand (`src`, `title`,
`meta`, optional `ratio`). The hero photo on the left panel is `site/assets/hero-forest.jpg`.
