# Static Bloom — a tiny art & music collective site

A small, **fully static** website for showing cover artwork, short music
facts, and outbound links to Telegram and SoundCloud. Built with plain HTML,
CSS, and vanilla JavaScript — no frameworks, no build step, no npm, no
backend. Designed to be deployed free on **GitHub Pages**.

## Table of contents

- [What the site is](#what-the-site-is)
- [Assumptions](#assumptions)
- [File tree](#file-tree)
- [Run it locally](#run-it-locally)
- [Editing the content](#editing-the-content)
- [Replacing the images](#replacing-the-images)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [How the "resume" feature works](#how-the-resume-feature-works)
- [Caveats & gotchas](#caveats--gotchas)
- [License note](#license-note)

## What the site is

One page with four parts:

1. **Gallery** — cards built from `data/artworks.json`, filterable by type
   (All / Music / Cover / Mixed). Clicking (or pressing Enter on) a card opens
   a details dialog with the description, facts, and outbound links.
2. **Facts feed** — short entries from `data/facts.json`. Some link to an
   artwork ("View artwork") or to an external https:// page.
3. **Links section** — hardcoded links to the collective's Telegram and
   SoundCloud.
4. **Resume section** — if you visited before in the same browser, buttons
   appear to reopen the last artwork you clicked or jump back to where you
   had scrolled.

It has **no** accounts, cookies, analytics, tracking, shopping cart, paywall,
checkout, server code, or anything that can "sleep" or need restarting. All
outbound links open in a new tab with `rel="noopener noreferrer"`.

## Assumptions

These choices were made because the brief said not to ask questions. If any
of them is wrong for you, they are all easy to change.

- **Collective name.** The sample content uses the placeholder name
  "Static Bloom". Replace it in `index.html` (title, header, hero, footer),
  `styles.css` comments, and `README.md`.
- **Placeholder social URLs.** `https://t.me/yourhandle` and
  `https://soundcloud.com/yourhandle` appear in the links section and in the
  sample JSON. Replace every occurrence with your real handles.
- **Sample content.** Three artworks and three facts ship with the site. They
  are realistic but fictional — replace them with your own work. No lorem
  ipsum is used anywhere.
- **SVG as cover images.** The shipped placeholders are text-based SVGs
  (`assets/covers/sample-1.svg` … `sample-3.svg`). SVG works fine in every
  modern browser `<img>` tag, but if you export covers from design tools,
  JPG/PNG/WebP are usually safer (embedded fonts/scripts in SVG can break or
  be a concern for user-submitted files).
- **Missing-image degradation.** If a `coverImage` path in the JSON points at
  a file that doesn't exist, the script swaps in an inline SVG placeholder
  that shows the artwork title, so you never see a broken-image icon.
- **Single language.** The site is English-only (`lang="en"`); there is no
  language switcher.
- **Empty source arrays.** If `artworks.json` parses to `[]`, the gallery
  shows "No artworks yet." inside the grid; if `facts.json` parses to `[]`,
  the facts live region shows "No facts yet." These are distinct from the
  zero-filter-results message.
- **Filter yields zero results.** When an active filter (Music/Cover/Mixed)
  matches nothing, the gallery's aria-live region shows
  "No artworks match this filter." This does not clear your data — switch
  back to All.
- **Unrecognized artwork `type`.** The `type` field is expected to be one of
  `music`, `cover`, `mixed`. Any other value is **not dropped**: the artwork
  still renders under **All**, is excluded from the three type filters, and
  once per page load the gallery's aria-live region announces
  `Artwork "{title}" has an unrecognized type and is shown under All only.`
- **Fetch failure + resume.** If `data/artworks.json` fails to load (bad
  network, invalid JSON), the gallery shows a friendly message in its
  aria-live region and the rest of the page stays usable. In that case the
  "Continue from {title}" button **cannot** appear (the title is unknown),
  even if an artwork id is stored — but "Resume scrolling" can still appear.
- **Both resume buttons can show.** When both a valid stored artwork *and* a
  valid stored scroll position exist, **both** buttons are shown. Neither
  takes precedence and neither fires automatically; each click performs only
  its own action.
- **Only https:// outbound links are rendered.** Links from JSON whose URL is
  missing or does not start with `https://` are silently skipped.
- **The site is purely static.** GitHub Pages serves files; there is nothing
  to keep awake, no cold starts, no manual restarts ever needed.
- **Resume is local.** localStorage is per-browser and per-device. It is not
  synced, not sent anywhere, and cleared when site data is cleared.

## File tree

```
/
├── index.html          # the whole site (one page)
├── styles.css          # mobile-first styles, CSS variables, a11y states
├── app.js              # single IIFE: fetch, render, filter, modal, resume
├── 404.html            # GitHub Pages 404 page (relative "./" back-link)
├── .nojekyll           # tells GitHub Pages not to process with Jekyll
├── favicon.svg         # site icon
├── README.md           # you are here
├── data/
│   ├── artworks.json   # gallery content
│   └── facts.json      # facts feed content
└── assets/
    └── covers/
        ├── .gitkeep
        ├── sample-1.svg
        ├── sample-2.svg
        └── sample-3.svg
```

## Run it locally

Because the page loads its content with `fetch()`, you must serve it over
HTTP — **opening `index.html` directly via `file://` will not work** (browsers
block `fetch()` from `file://` pages and you'll see the friendly error
messages instead of content).

From the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/> in your browser. Any other static server
works too (e.g. `php -S localhost:8000`). No installation, no build step.

## Editing the content

Everything you'd normally change lives in the two JSON files. You can edit
them in any text editor (Notepad, TextEdit in plain-text mode, VS Code…).

### `data/artworks.json`

A JSON **array** of objects. Each object:

| Field         | Type              | Meaning                                                                 |
|---------------|-------------------|-------------------------------------------------------------------------|
| `id`          | string            | Unique, URL-safe identifier (used by facts and localStorage).           |
| `title`       | string            | Artwork title. Shown on the card, dialog heading, alt text.             |
| `artist`      | string            | Creator name(s).                                                        |
| `year`        | number            | Year, e.g. `2025` (no quotes).                                          |
| `type`        | string            | One of `"music"`, `"cover"`, `"mixed"` (see Assumptions for other values). |
| `coverImage`  | string            | **Relative** path to an image, e.g. `assets/covers/my-cover.jpg`.       |
| `description` | string            | Short paragraph shown in the dialog.                                    |
| `facts`       | array of strings  | Bullet points shown in the dialog.                                      |
| `links`       | object (optional) | `"telegram"` and/or `"soundcloud"` keys, each a full `https://` URL.    |
| `tags`        | array of strings  | Shown as a comma-separated line in the dialog.                          |

Example entry:

```json
{
  "id": "my-song",
  "title": "My Song",
  "artist": "Me",
  "year": 2026,
  "type": "music",
  "coverImage": "assets/covers/my-song.jpg",
  "description": "Recorded in a kitchen.",
  "facts": ["One take.", "Broken mic."],
  "links": { "soundcloud": "https://soundcloud.com/yourhandle/my-song" },
  "tags": ["demo"]
}
```

### `data/facts.json`

A JSON **array** of objects. Each object:

| Field              | Type            | Meaning                                                            |
|--------------------|-----------------|--------------------------------------------------------------------|
| `id`               | string          | Unique identifier.                                                 |
| `title`            | string          | Fact headline.                                                     |
| `body`             | string          | The fact itself.                                                   |
| `relatedArtworkId` | string (opt.)   | An artwork `id`; adds a "View artwork" button. If the id doesn't match any artwork, the button is simply omitted. |
| `link`             | object (opt.)   | Exact shape: `{ "text": "shown text", "url": "https://…" }`. Only `https://` URLs render. |

⚠️ **Invalid JSON breaks the gallery.** A stray comma, a missing quote, or a
comment (`//`) makes the file unparseable — the site then shows a friendly
error message in the gallery/facts status areas instead of content. If the
gallery suddenly goes empty, re-check your JSON with a validator (paste it
into <https://jsonlint.com> or run `python3 -m json.tool data/artworks.json`).

## Replacing the images

Drop your real cover images into `assets/covers/` — JPG, PNG, WebP, GIF, or
SVG all work in the `<img>` tags used here — and set each artwork's
`coverImage` to the matching **relative** path, e.g.
`"coverImage": "assets/covers/poster.jpg"`. Filenames in the JSON must match
the actual files exactly (including capitalization — GitHub Pages is
case-sensitive). You can delete the `sample-*.svg` files once nothing refers
to them; if you do delete one but forget to update the JSON, the site will
gracefully show a title placeholder instead of a broken image.

## Deploying to GitHub Pages

1. Create a **public** repository on GitHub (e.g. `static-bloom`).
2. Upload all the files above to the repo (via the web UI "Add file →
   Upload files", or `git push`). Make sure they sit at the repository root
   as in the file tree.
3. Go to **Settings → Pages**.
4. Under *Build and deployment → Source*, choose **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**, then Save.
6. Wait a minute or two; GitHub will show your live URL, like
   `https://username.github.io/static-bloom/`.

That's it — no build command, nothing to restart. Every later push to `main`
redeploys automatically. `.nojekyll` is already included so GitHub skips
Jekyll processing (this also means files/folders starting with `_` would
work, though none are used here).

## How the "resume" feature works

The site remembers three things in your browser's localStorage (all wrapped
in try/catch — if storage is blocked, everything still works, just without
memory):

- `artmusic:lastArtworkId` — written **only when you click a gallery card**
  (not when opening via a fact's "View artwork" button or the resume button).
- `artmusic:lastScrollY` — how far down the page you were (saved ~every
  150 ms while scrolling, plus on page hide / tab switch).
- `artmusic:lastFilter` — which filter (All/Music/Cover/Mixed) was active;
  it is restored *before* the first render, so the gallery appears once,
  already filtered.

On your next visit, after the artworks have loaded, a "Continue where you
left off" section may appear with:

- **"Continue from {title}"** — opens that artwork's dialog. Nothing opens
  automatically.
- **"Resume scrolling"** — jumps back to your saved scroll position. Scroll
  is only restored when you click this button (after the gallery and facts
  have finished rendering), never automatically.

If both apply, both buttons show. Invalid or stale values (deleted artwork,
negative scroll number, unknown filter) are ignored silently. Remember:
localStorage is **per browser and per device** — your phone doesn't know
what your laptop saw, and clearing site data wipes it.

## Caveats & gotchas

- **The 404 page uses `href="./"` — leave it alone.** On GitHub Pages this
  relative link resolves to the site root correctly in both cases: a
  user/org site (`https://username.github.io/anything` → `./` = `/`) and a
  project site (`https://username.github.io/repo/anything` → `./` = `/repo/`).
  Do **not** replace it with an absolute path like `/` or `/repo/` — either
  one breaks the other hosting scenario. Also note GitHub Pages only serves
  this custom 404 for requests within the published site's directory scope.
- **Social previews (Open Graph).** `og:image` here uses a relative path to
  keep the site portable, but most social scrapers (Telegram, Twitter/X,
  Discord…) require an **absolute URL** like
  `https://username.github.io/repo/assets/covers/sample-1.svg` to render a
  preview image. Once your domain is final, paste the absolute URL into the
  `og:image` (and ideally `og:url`) meta tags in `index.html`. Everything
  else in the site intentionally uses relative paths so it works under a
  project subdirectory *and* a custom domain without edits.
- **Outbound links only.** Links to Telegram/SoundCloud (and https:// links
  from JSON) are fine and always open with
  `target="_blank" rel="noopener noreferrer"`. Please don't add checkout,
  paywalls, or "buy" flows — this site is a showcase, not a shop.
- **No cookies, no analytics, no tracking.** By design. Don't bolt on a
  tracker; it would also make the privacy claims in the footer untrue.
- **Accessibility is baked in:** cards are real `<button>`s, the modal is a
  native `<dialog>` (Escape/backdrop/close-button all work, focus returns to
  whatever opened it), filters use `aria-pressed` inside a labelled group,
  error/empty messages go into pre-existing `aria-live="polite"` regions,
  contrast meets WCAG 2.1 AA, and `prefers-reduced-motion` disables the
  dialog animation, hover transforms, and smooth scrolling.

## License note

Suggested split, reflected in the footer: put the **code** (HTML/CSS/JS)
under the MIT license (add a `LICENSE` file if you want), while the
**artwork, music, and text content** remain © their creators, all rights
reserved. Code being open does not give anyone permission to reuse the art.
