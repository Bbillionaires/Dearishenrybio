# De'Aris Henry — Executive Portfolio & Professional Resume

A static, dependency-free website (HTML/CSS/vanilla JS). No build step is needed to
serve it; the `tools/` scripts only regenerate assets.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | The full portfolio (all sections, SEO metadata, JSON-LD) |
| `assets/css/styles.css` | Design system: colors, glass panels, coin, map, signature |
| `assets/js/starfield.js` | Canvas starfield and bidirectional meteors |
| `assets/js/main.js` | Navigation, reveal effects, map, contact form, signature |
| `assets/js/site-config.js` | **Edit this:** contact details, form endpoint, verified records, book links |
| `resume/index.html` | ATS-friendly printable resume (source of the PDF) |
| `resume/DeAris-Henry-Resume.pdf` | Downloadable resume |
| `tools/` | Asset generators and the verification suite |

## Editing verified information

All values that need verification live in `assets/js/site-config.js`:

- `contact.email`, `contact.phone`, `contact.linkedin`: shown on the site and resume only when filled in.
- `contact.formEndpoint`: a form backend URL (Formspree-compatible JSON POST). Without one, the
  form opens the visitor's email app addressed to `contact.email`. The form also carries Netlify
  Forms attributes, so on Netlify it can post natively.
- `verifiedRecords`: verified closed transactions, actual gross sales, realized returns. Empty
  values display "Pending verification". Proposed scenarios are never summed into these.
- `bookLinks`: verified purchase links per book.

Venture, technology, and book **status labels** are set in `index.html` (`status--operating`,
`status--development`, `status--concept`, `status--proposed`, `status--pending`).

After you change contact details, rebuild the PDF so it includes them: `npm run build:assets`.

## Commands

```bash
npm install            # dev-only deps for the map generator
npm run build          # regenerate map, signature, coin PNG/WebP, icons, OG image, PDF
npm run serve          # http://localhost:8080 (normal caching, max-age 3600)
npm run verify         # end-to-end checks (run while `serve` is running)
```

Asset sources: `tools/coin.html` (both coin faces), `tools/build-signature.mjs` (hand-authored
pen strokes with a broad-nib width model), `tools/build-map.mjs` (Natural Earth map), `tools/og.html`.

## Deploying

Upload the repository root to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
Once the domain is known, change the `og:image` and `twitter:image` URLs in `index.html` to absolute
URLs (`https://your-domain/assets/img/og-image.jpg`) and add a `<link rel="canonical">` tag, so
social previews resolve.

## Animation behavior

- The starfield starts on every visit. It pauses while the tab is hidden and resumes when the tab is
  visible again, and it restarts after a back/forward-cache restore (`pageshow`). It uses no storage flags.
- With `prefers-reduced-motion`, the sky is static (no meteors), the coin is still, and the
  signature appears without the drawing animation.
- `window.Starfield.init()` / `.destroy()` make it safe to use with client-side routers.
