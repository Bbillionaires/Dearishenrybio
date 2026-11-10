# De'Aris Henry — Executive Portfolio & Professional Resume

A static, dependency-free website (HTML/CSS/vanilla JS). Visitors enter through a bank-vault door;
inside, the hero sits in the vault, followed by light, spacious pages and a dark signature footer. No build step is needed to
serve it; the `tools/` scripts only regenerate assets.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | The full portfolio (all sections, SEO metadata, JSON-LD) |
| `assets/css/styles.css` | Design system: colors, glass panels, coin, map, signature |
| `assets/js/vault.js`, `assets/css/vault.css` | Vault-door entrance and the vault-interior hero |
| `assets/js/main.js` | Navigation, reveal effects, map, contact form, signature |
| `assets/js/site-config.js` | **Edit this:** contact details, form endpoint, verified records, book links |
| `resume/index.html` | ATS-friendly printable resume (source of the PDF) |
| `resume/DeAris-Henry-Resume.pdf` | Downloadable resume |
| `tools/` | Asset generators and the verification suite |

## Editing verified information

All values that need verification live in `assets/js/site-config.js`:

- `contact.email`: the inbox that receives contact-form requests (currently dearishenry@gmail.com).
- `contact.showEmail`: `false` keeps the address off the page and resume; `true` displays it.
- `contact.formEndpoint`: the form backend. It is set to FormSubmit, which forwards each
  submission to the inbox. **The first submission triggers a one-time activation email from
  FormSubmit; click "Activate Form" in it.** Messages arrive after that. Any Formspree-compatible JSON
  endpoint also works.
- `contact.imdb`, `contact.linkedin`, `contact.phone`: shown when filled in.
- `bookLinks`: verified purchase links per book.

Venture, technology, and book **status labels** are set in `index.html` (`status--operating`,
`status--development`, `status--concept`, `status--proposed`, `status--pending`).

After you change contact details, rebuild the PDF so it includes them: `npm run gen:assets`.

## Commands

```bash
npm install            # dev-only deps for the map generator
npm run assets         # regenerate map, signature, coin PNG/WebP, icons, OG image, PDF
npm run serve          # http://localhost:8080 (normal caching, max-age 3600)
npm run verify         # end-to-end checks (run while `serve` is running)
```

Asset sources: `tools/coin.html` (both coin faces), `tools/build-signature.mjs` (hand-authored
pen strokes with a broad-nib width model), `tools/build-map.mjs` (Natural Earth map), `tools/og.html`.

## Deploying

Upload the repository root to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
The site is configured for **https://dearishenry.com** (canonical URL, social preview images,
`sitemap.xml`). If the domain changes, search the repo for `dearishenry.com`.

## Animation behavior

- **Vault entrance:** on every visit, a vault door fills the screen. Its wheel turns
  counter-clockwise, the bolts retract, the door swings open, and the view moves into the vault.
  Visitors can drag the wheel counter-clockwise themselves, click or tap it, press Enter, Space or ←,
  or wait about 2.4 seconds for it to open on its own. **Skip intro** or Esc goes straight in.
- The entrance is skipped for deep links (for example `/#contact`) and for visitors with
  `prefers-reduced-motion`. It uses no storage flags. A failsafe in `<head>` removes the door if
  `vault.js` fails to load.
- The page behind the door is `inert` until the vault is open.
- Vault interior artwork: `tools/vault.html` → `assets/img/vault-interior*.webp/.jpg` (`npm run gen:assets`).
