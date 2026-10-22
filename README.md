# jmsn.art — modern site

The approved contemporary design lives on **`modern-site`**. GitHub Pages publishes this branch at https://jmsn.art/.

## Original site preserved

- `main` remains the original site at `e13668091f11b92a95a61d6516d1e5cc32bea8dc`.
- Tag `classic-2026-10-21` records that same original revision.
- `/classic/` is a browsable copy of the old site. Its page links stay in `/classic/`; images, videos and unchanged scripts are shared from the root. These pages are marked `noindex`.
- `/index-backup.html` opens the classic homepage.
- `classic/source-manifest.json` records SHA-256 hashes of the original HTML files before link adjustment. The exact original files remain on `main` and the tag.

Do not merge this branch into `main` or change the repository default branch: the artist asked to leave the old GitHub site intact. Future live-site edits belong on branches based on `modern-site` and should merge back to `modern-site`.

## Design and scope

All 16 root HTML pages use the shared modern presentation in `modern/site.css` and navigation behavior in `modern/site.js`. The homepage uses `modern/home.css` and `modern/home.js`, based on the approved preview, with the hook “The sacred. Hiding in plain sight.”

Artwork files, metadata, archive order, study count, video, and creative-tool functionality are retained. The existing truncated `make-halo.html` script was completed from the full companion editor `make.html`. The unlisted Studio application and `_studio` development project are separate and unchanged. Shopify remains an external store.

Original header/footer hooks remain hidden and inert where existing scripts reference them; visitors receive the shared modern navigation and footer. The modern presentation uses a consistent light theme independently of previous theme preferences.

## Local preview and checks

Run `python3 -m http.server 8878 --bind 127.0.0.1` from this directory and visit http://127.0.0.1:8878/.

The DOM smoke test needs jsdom 26, installed outside this repository:

```sh
npm install --prefix /tmp/jmsn-modern-qa --no-audit --no-fund jsdom@26
NODE_PATH=/tmp/jmsn-modern-qa/node_modules node _checks/modern-smoke.cjs
```

The test checks all 16 page scripts, unique IDs, shared navigation, menu state, homepage expansion/viewer/zoom, archive controls/count, study count/reshuffle, and contact validation. Canvas, media, and layout APIs are mocked; this is not a visual or WebGL test.

Before publishing, also check HTML asset references, inline JavaScript syntax, and browser rendering. October 21 verification: all DOM checks passed, all local references resolved, and all inline scripts parsed. Homepage and viewer rendered in Chrome; About content was confirmed in the browser accessibility tree. Further screenshot/mobile visual checks were limited by native screen-capture failures.

## Rollback

In GitHub repository Settings → Pages → Build and deployment, change the source branch from `modern-site` to `main`, keeping the root folder `/`. This restores the untouched original site without reverting commits. Keep the custom domain `jmsn.art` and HTTPS unchanged.
