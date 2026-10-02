# Analytics

Default is **off** (`analytics.provider: "none"`): no script is loaded, nothing is sent.

## Config (`content.analytics`)

| key | meaning |
|---|---|
| `provider` | `none` (default), `ga4`, `plausible`, `custom` |
| `id` | GA4 measurement id, like `G-ABC1234XYZ` |
| `domain` | Plausible site domain, like `skillsoftomorrow.com` |
| `endpoint` | `custom`: https URL (or `/path`) that receives a `sendBeacon` POST: `{"event","props","path"}` as `text/plain` JSON |
| `respectDnt` | default `true`: if the browser sends Do Not Track or Global Privacy Control, nothing loads |
| `requireConsent` | default `false`: if `true`, nothing loads/sends until `setAnalyticsConsent(true)` (exported from `src/integrations/analytics.js`) is called, for example from a cookie banner you add |

Provider scripts are loaded lazily, only when a provider is configured (and consent, if required).

## Events

`page_load`, `form_open`, `form_submit {success, reason?}`, `booking_open`, `booking_complete`, plus the app-wide ones Agent 4 fires (`know_more_click`, `stage_progress`, `cta_click`, `faq_toggle`, `nav_click`) and `web_vital {metric: LCP|CLS|INP, value, rating}` sent once when the tab is hidden. Every event gets `device: 'mobile'|'desktop'` automatically.

No PII: `track()` drops any property whose name looks personal (name, email, phone, message, address, ip, token...), any string longer than 80 characters, and any value that looks like an email or phone number. `form_submit` only carries a boolean and a failure category. The `ga4` provider is configured with `anonymize_ip`, Google Signals and ad personalization off.

Web Vitals use `PerformanceObserver` directly (about 1 KB gzipped) instead of the `web-vitals` package. INP is approximated as the worst interaction, CLS as the worst session window.

## Consent considerations (not legal advice)

* **GA4 sets cookies** (`_ga`, `_ga_*`). Under GDPR/ePrivacy that generally needs prior consent for EU/UK visitors; India's DPDP Act 2023 centres on notice and consent for processing personal data. Whether analytics identifiers count, and what you must show, is for the owner and their adviser to decide.
* **Plausible** is cookieless and does not store personal data by design; it still should be mentioned in the privacy policy.
* **custom** sends only what is listed above, and sets no cookies itself; what your server logs (IP, user agent) is your responsibility.
* If in doubt: keep `provider: "none"`, or use `requireConsent: true` and add a banner that calls `setAnalyticsConsent`.
* Mention every processor (analytics, Calendly, form backend) in the privacy policy: [PLACEHOLDER].

## Not tested

Real GA4, Plausible and custom collectors were not contacted. Only the provider selection, DNT handling, sanitizing and the custom `sendBeacon` payload were unit-tested with mocks.
