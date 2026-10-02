# Deployment

The deployable output is `app/dist/` (run `cd app && npm ci && npm run build`). It is a static site: no server code, no env vars needed at build or run time. Everything editable lives in `dist/data/content.json`.

## Vercel
1. Import the repo, set **Root Directory** = `app`, Framework = Vite, Build = `npm run build`, Output = `dist`.
2. Add `app/vercel.json` (template below) for headers and caching.
3. Add the domain, then SSL is automatic.

```json
{
  "cleanUrls": true,
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://assets.calendly.com; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src https://calendly.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
    ]},
    { "source": "/assets/(.*)", "headers": [ { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] },
    { "source": "/data/content.json", "headers": [ { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/images/(.*)", "headers": [ { "key": "Cache-Control", "value": "public, max-age=86400" } ] }
  ]
}
```
`cleanUrls` makes `/privacy` work for `privacy.html`. Vercel serves `404.html` automatically for unknown paths.

## Netlify
Build command `npm run build`, base directory `app`, publish directory `app/dist`. Add `app/public/_headers` (copied into `dist/`):
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://assets.calendly.com; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src https://calendly.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/data/content.json
  Cache-Control: public, max-age=0, must-revalidate
```
Netlify also serves `404.html` automatically. No SPA fallback rule is needed: the app is a single page and the legal pages are real files (`/privacy.html`, `/terms.html`, `/refund.html`). Do NOT add a catch-all rewrite to `index.html`, or unknown URLs will return 200 instead of a real 404.

## Caching (why)
- `/assets/*` filenames are content-hashed, so they can be cached for a year.
- `/data/content.json` must revalidate on every load so edits go live immediately (the app also fetches it with `cache: 'no-cache'`). It is ~5 KB, so the cost is one conditional request.
- After editing `content.json` only that file needs to be redeployed (or edited in place on the host).

## CSP notes
The proposed policy was tested in headless Chromium against the production build, including the real Calendly embed (widget script, stylesheet and iframe): 0 CSP violations. It allows:
- `style-src 'unsafe-inline'` because React sets inline `style` attributes and Calendly injects styles. There are no inline scripts in `index.html`. The static legal pages and `404.html` do have one small inline script (it copies theme colors from content.json); under this CSP the browser blocks it, so those pages simply keep their built-in default colors (not tested in a browser under CSP: this is expected behaviour, verify once deployed). To keep theme colors there, move that script to a file under `public/`.
- `img-src https:` because mentor/company images can be any https URL in content.json. Tighten to your image host once known.
- Extend when you enable integrations: form endpoint host in `connect-src` (Formspree: `https://formspree.io`; Apps Script: `https://script.google.com https://script.googleusercontent.com`), analytics (GA4: `script-src https://www.googletagmanager.com`, `connect-src https://*.google-analytics.com https://*.analytics.google.com`; Plausible: its script host and `connect-src https://plausible.io`).
- `frame-ancestors 'none'` blocks other sites from embedding the page.

## Before going live
1. Replace `https://example.com` in `public/robots.txt` and `public/sitemap.xml` with the real domain.
2. In `index.html` add `<link rel="canonical">` and `og:url`, and make `og:image` and `twitter:image` absolute URLs (the crawler cannot resolve `/og-image.png` on some platforms). Replace `public/og-image.png` with final artwork (1200x630).
3. Fill the placeholders in `CONTENT_TODO.md` (`npm run todo` regenerates it), including the Calendly URL and form endpoint.
4. Update the `<noscript>` text in `index.html` if the headline or contact email changes (it is static, not generated).
5. Replace the placeholder legal pages with reviewed text.
6. Run `npm run check:theme` after any color change, `npm run test:unit`, then `npm run build`.

## Rollback
Static deploys are immutable on both hosts: promote the previous deployment in the Vercel/Netlify dashboard ("Instant Rollback" / "Publish deploy"). Keep the previous `content.json` in version control.

## Monitoring
Not configured. Add uptime monitoring and error logging (Sentry) and Core Web Vitals reporting (the app has a `webvitals` hook that reports through the analytics provider once one is configured).
