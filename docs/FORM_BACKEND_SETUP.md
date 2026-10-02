# Form backend setup

`content.form.submitEndpoint` empty = **demo mode**: nothing is sent or stored, the form just shows success. Set it to a real endpoint to collect applications. The form sends six fields: `name`, `email`, `phone`, `degree`, `status`, `message`. Nothing else (the anti-spam honeypot is never sent).

`content.form.submitFormat`:

| value | request | use with |
|---|---|---|
| `json` (default) | `POST`, `Content-Type: application/json` | your own API (must allow CORS from your site origin) |
| `formspree` | as json plus `Accept: application/json` | Formspree |
| `form-urlencoded` | `application/x-www-form-urlencoded` | services/PHP that expect form posts |
| `google-apps-script` | `no-cors` POST, `text/plain` body containing JSON | Apps Script web app |

Behaviour: 10 s timeout, one automatic retry on a network error only (not on timeout or HTTP errors), then a message for offline / timeout / 4xx / 5xx (strings in `ui.form.submitError*`). Submissions made within `form.minSubmitSeconds` (default 3) of opening the form, or with the hidden field filled, are treated as bots: the visitor sees success, nothing is sent.

## A. Formspree

1. Create an account at formspree.io, click "New form", copy the endpoint, like `https://formspree.io/f/xxxxxxxx`.
2. In the form's Settings add the email addresses to be notified, and under "Restrict to domain" add your production domain.
3. In `content.json`:
   ```json
   "form": { "submitEndpoint": "https://formspree.io/f/xxxxxxxx", "submitFormat": "formspree" }
   ```
4. Submit one test application from the live site and check the Formspree inbox. Formspree's own spam filter/reCAPTCHA settings are separate from this app's honeypot.

## B. Google Apps Script to Google Sheet

1. Create a Google Sheet. Put these headers in row 1: `timestamp, name, email, phone, degree, status, message`.
2. Extensions > Apps Script. Replace the code with:
   ```javascript
   const SHEET_NAME = 'Sheet1';
   const FIELDS = ['name', 'email', 'phone', 'degree', 'status', 'message'];

   function doPost(e) {
     try {
       const data = JSON.parse(e.postData.contents);
       const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
       // Prefix with ' so values starting with = + - @ are not run as formulas
       const safe = (v) => { v = String(v || '').slice(0, 1000); return /^[=+\-@]/.test(v) ? "'" + v : v; };
       sheet.appendRow([new Date(), ...FIELDS.map((k) => safe(data[k]))]);
       return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
3. Deploy > New deployment > type "Web app". Execute as: **Me**. Who has access: **Anyone**. Authorize when prompted. Copy the `/exec` URL.
4. In `content.json`:
   ```json
   "form": { "submitEndpoint": "https://script.google.com/macros/s/XXXX/exec", "submitFormat": "google-apps-script" }
   ```
5. Re-deploying after code changes: Deploy > Manage deployments > edit > New version (the URL stays the same).
6. Optional: add `MailApp.sendEmail('you@example.com', 'New application', 'A new row was added')` inside `doPost` for an email notification (do not put the applicant's data in that email if the inbox is shared).

**Caveat (google-apps-script format):** the browser cannot read the response of a `no-cors` request. The app treats "request completed" as success. If the script errors (quota, wrong deployment access, a typo), the visitor still sees success. Check the Sheet regularly, and after every change submit a test.

## C. What was NOT tested

The Formspree and Google Apps Script flows above were **not** run against the real services. The request formats were verified against a local mock HTTP server only (status codes, headers, body, timeout, offline). The Apps Script code is unexecuted. Test both with a real submission before launch.

## Privacy checklist (owner to review; this is not legal advice)

| Question | Answer for this site |
|---|---|
| What is collected? | Name, email, phone, degree/background, current status, optional free-text message. |
| Where does it go? | Only to the endpoint you set in `submitEndpoint` (Formspree, your Google Sheet, or your API). In demo mode nowhere. The app itself stores nothing (no cookies, localStorage, or logs of form values). |
| Who can access it? | Whoever you add to the Formspree account / share the Google Sheet with. Keep the Sheet private; use individual accounts, not a shared password. |
| Retention | [PLACEHOLDER: decide how long applications are kept, for example 12 months, and who deletes them]. |
| Third-party processors | Formspree or Google (Sheets/Apps Script), plus Calendly for booking. Mention them in the privacy policy. |
| Consent / notice | The form should link to the privacy policy. Suggested line (to be reviewed): [PLACEHOLDER: "By submitting, you agree that Skills of Tomorrow may contact you about the program using these details. Read our Privacy Policy."]. |
| Rights requests | [PLACEHOLDER: contact email for access/correction/deletion requests]. Under India's DPDP Act 2023 and, if you target EU visitors, GDPR, people can ask to see, correct or delete their data. Ask a qualified professional which obligations apply to you. |
| Minors | The program targets graduates; if under-18 visitors are possible, check parental-consent rules. |
| Security | Restrict Formspree to your domain; do not make the Sheet public; never paste the endpoint into public repos if it is an unauthenticated write URL you want to keep private (note: it is visible in `content.json` to anyone visiting the site anyway, which is why the honeypot and Formspree spam settings matter). |
