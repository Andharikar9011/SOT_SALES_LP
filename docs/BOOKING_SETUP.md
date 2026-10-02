# Booking setup (Calendly)

The site embeds one Calendly event inline after a visitor submits the application form. Calendly itself sends the confirmation emails and calendar invites; this app sends nothing.

## 1. Calendly side (owner does this)

1. Create a Calendly account (the owner's business email).
2. **Connect Google Calendar**: Calendly > Integrations > Calendar connections > Google Calendar. Choose the calendar that should be checked for conflicts AND the calendar new events are added to. This is what puts booked calls in the owner's Google Calendar with a Meet/Zoom link.
3. **Create an event type** (for example "Intro call", 20-30 min). Set location (Google Meet / phone / Zoom).
4. **Availability**: set working hours. Timezone is detected automatically for each visitor (shown in their local time), so you do not configure it per visitor.
5. **Buffers**: under the event type > Availability > "Add buffer", set 15-30 minutes before/after.
6. **Notifications and emails**: event type > Notifications and cancellation policy. Keep "Email confirmation" on; optionally add a reminder (for example 24 h and 1 h before). Confirm the "From"/reply-to shown to invitees (Calendly sends from its own address, reply-to is the owner's).
7. **Invitee questions** (optional): add custom questions (for example "What do you want to achieve?"). Name and email are always collected by Calendly. Keep questions minimal.
8. **Confirmation page / redirect** (optional): event type > Confirmation page. The default Calendly page is fine for an embed. A redirect to your own thank-you URL is possible, but inside the embed it navigates the iframe only, and the app's own confirmation message (triggered by Calendly's `calendly.event_scheduled` message) still works. Leave the default unless you have a reason.
9. Copy the event link, for example `https://calendly.com/your-name/intro-call`.

## 2. App side

Edit `public/data/content.json`:

```json
"booking": {
  "calendlyUrl": "https://calendly.com/your-name/intro-call",
  "fallbackEmail": "you@example.com",
  "prefill": false
}
```

* The URL must be `https://calendly.com/<user>/<event>`. Anything else (other host, http, credentials, the `[PLACEHOLDER]` text) is refused: the modal shows the "not configured" or error message and the email fallback instead of embedding.
* Theme: the embed receives `background_color`, `text_color`, `primary_color` (from `theme.colors.background`, `.text`, `.primary`, without `#`) and `hide_gdpr_banner=1`. Calendly's embed only honours these on paid/plus plans for some of them; on the free plan the page may keep Calendly's default look (this was not tested against a real account).
* `prefill`: `false` (default) means nothing from the application form is passed to Calendly and the visitor types name/email again. `true` passes only name and email, in the embed URL, which Calendly receives in any case when the visitor books. This is a privacy trade-off; decide consciously.
* The widget script (`assets.calendly.com`) is loaded only when the booking modal is first opened, once.
* If the widget does not load within 12 seconds, or the script is blocked (ad blockers), the visitor sees the error message and a `mailto:` button (`booking.fallbackEmail`).
* When Calendly posts `calendly.event_scheduled` (origin checked: `https://calendly.com`), the modal shows a confirmation with a 5 second visible countdown and closes. Any click, tap or key press cancels the auto-close.

## 3. What was and was not tested

Tested: URL validation, embed-URL building, origin check, confirmation/countdown/auto-close, error states, reopen, with a **stubbed** `widget.js` and simulated `postMessage` events.
**Not tested**: the real Calendly widget, real bookings, Google Calendar sync, Calendly emails. Do one real test booking after setting the URL (and cancel it).

## 4. Launch checklist

- [ ] `booking.calendlyUrl` is the real event link
- [ ] Test booking made from a phone and a desktop; invite arrives in the owner's Google Calendar
- [ ] Confirmation email received by the test invitee
- [ ] `booking.fallbackEmail` is a monitored inbox
