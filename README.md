# 🎄 Christmas Lottery

A tiny, dependency-free website for running the family Secret Santa draw and
publishing the results on **GitHub Pages**.

Live site (after setup): **https://mika9949.github.io/xmas/**

## The rules

A valid draw assigns every person exactly one person to give to, such that:

1. **Nobody gives to themselves** (it's a derangement).
2. **No last-year repeats** — a giver may not give to the same person they gave
   to in the single immediately-preceding year. This resets each year: a pairing
   blocked in 2026 (because it happened in 2025) is allowed again in 2027.
3. **Forbidden pairs** may not exchange in *either* direction:
   - Tua ↔ Evan
   - Ulf ↔ Robin
   - Lennart ↔ Anette
4. **No two-person loops** — if A gives to B, then B may not give back to A.

The official draw for a given year also cannot be run **before October 1 of that
year** — the button stays locked until then.

Results are displayed in **loop order**: each row's receiver is the next row's
giver. A draw may form one big loop or several smaller ones; each loop is listed
in turn, and the last row of a loop gives back to that loop's first row.

Participants and forbidden pairs live in [`data/config.json`](data/config.json).
Past results live in [`data/results.json`](data/results.json) (seeded with 2025).

## The tabs

- **🦆 Example** — a safe demo using seven Donald Duck characters. Re-rollable,
  never saved.
- **🎲 Official draw** — the real thing. Tick the confirmation box, type your
  name and the password (**`pepper`**), press **Run official draw**, confirm
  *"Are you sure?"*, and the result appears with the runner's name shown above it.
  The target year is derived automatically as *(latest recorded year + 1)*.
  (The password lives in the page's JavaScript, so it's a light speed-bump, not
  real security.)
- **📜 Previous years** — pick any recorded year to see its result.

## Publishing an official result

A drawn result only lives in the browser of the person who ran it until it is
saved to the repo. There are two ways to publish it:

### One-click (recommended)

1. Create a GitHub token: **Settings → Developer settings → Fine-grained tokens**,
   with **Contents: Read and write** permission on the `mika9949/xmas`
   repository.
2. After running the official draw, paste the token into the **GitHub token**
   field and press **🚀 Publish to the website**.
3. The site commits the updated `data/results.json` for you. Everyone sees the
   new result within a minute. The token stays only in your browser.

### Manual (no token)

Under *"Or publish manually"*:

1. Click **⬇️ Download results file** — a `results.json` with all years plus the
   new one.
2. On github.com, open `data/results.json`, choose **Upload / replace file**, and
   drop in the downloaded file.
3. Commit. Pages redeploys within a minute.

> Note: the repo is public, so published results are public either way. A token
> only grants whoever holds it write access — don't share it.

## First-time setup (enable the website)

1. Push this repository to `https://github.com/mika9949/xmas.git` (branch
   `main`).
2. On github.com go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, branch
   **`main`**, folder **`/ (root)`**, and save.
4. Wait a minute, then open **https://mika9949.github.io/xmas/**.

## Local preview

Because the page loads JSON with `fetch`, open it through a web server rather than
as a `file://` URL:

```sh
cd xmas
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Running the tests

The draw algorithm has a dependency-free Node test:

```sh
node test/draw.test.js
```

It checks that constrained draws are always valid derangements, that results
vary, that impossible constraint sets return `null`, and that the seeded 2025
result is itself valid.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Tabbed UI |
| `styles.css` | Festive styling |
| `app.js` | UI wiring: tabs, example, official draw, previous years |
| `draw.js` | Pure draw algorithm (shared by the site and the test) |
| `data/config.json` | Participants, forbidden pairs, duck characters |
| `data/results.json` | Recorded results per year |
| `test/draw.test.js` | Node test for `draw.js` |
