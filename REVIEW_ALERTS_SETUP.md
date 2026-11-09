# Rating alerts and owner-approved AI replies

Each owner selects an alert threshold for each business. Any whole number from
**1 through 5** is supported. New reviews at or below that selected number trigger
an alert; there is no fixed 3-star rule. The same selected value controls alerts,
the reply editor, and the Needs reply filter. The initial form default is 3 until
the owner selects another value.

| Owner selects | Customer ratings that trigger an alert |
|---|---|
| 1 | 1 |
| 2 | 1, 2 |
| 3 | 1, 2, 3 |
| 4 | 1, 2, 3, 4 |
| 5 | 1, 2, 3, 4, 5 |

Expired trials and expired/unverified subscriptions are blocked from review APIs
and skipped by background review/alert jobs. See [DEPLOYMENT.md](DEPLOYMENT.md)
for always-on hosting and production billing configuration.

The workflow is:

1. The background poller discovers a new Google review.
2. A qualifying review is saved with a pending alert. Historical reviews from the
   initial import are deliberately silent.
3. Groq generates an AI reply draft. If AI is unavailable, the alert can still be
   sent and the owner can write a reply or retry draft generation in the app.
4. Twilio receives a WhatsApp alert containing a link to that exact review and
   business. The link requires the owner's app login; it does not grant access.
5. The owner opens the app, reviews/edits the draft, and clicks **Approve & post to
   Google**. Only then does the backend send that exact text to Google's reply API
   using the connected business's OAuth credentials. Approval identity/time and
   the final text are stored. AI never posts before approval.

Approval happens in the dashboard reached from WhatsApp. Replying “approve” in a
WhatsApp conversation is not implemented. The previous unused auto-reply toggle
was removed to make the actual approval behavior clear.

## When the owner receives an alert

`REVIEW_POLL_INTERVAL_MINUTES` controls review discovery. With the value `120`,
a new review can wait about two hours before detection. For local testing use:

```dotenv
REVIEW_POLL_INTERVAL_MINUTES=1
```

This remains polling, subject to Google's review availability, API quota, and
network/provider delays. It is not an instant Google push notification.

A separate worker checks pending/failed alerts every minute, even if no new
review is found. Failed submissions use 1-, 2-, 4-, and 8-minute backoff between
attempts, up to five total attempts. The minute-based worker can add up to another
minute before an eligible retry is picked up. The owner can retry an exhausted failed
alert from the review card. Existing historical reviews are not automatically
backfilled into this queue, and raising a threshold does not notify for old
reviews that were already skipped.

If production disables Mongoose auto-indexing, create the new review alert queue
index declared in `server/models/Review.js` during deployment.

A database lease avoids duplicate submissions from overlapping workers.
`alertStatus=accepted` / `alertSent=true` means **Twilio accepted the message**,
not confirmed phone delivery. Inspect the Message SID in Twilio logs for final
delivery/errors. Provider acceptance followed by a lost database write can still
result in a duplicate alert on retry; delivery is not guaranteed exactly once.

## Server configuration

Store values in `server/.env` or the deployment's secret manager, never in Git:

```dotenv
GROQ_API_KEY=your_new_groq_key
GROQ_MODEL=llama-3.1-8b-instant
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_new_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+your_sender_number
TWILIO_REVIEW_ALERT_CONTENT_SID=your_approved_template_sid
FRONTEND_URL=https://your-public-frontend.example
```

The existing `claudeService.js` filename is retained for compatibility; it uses
**Groq**, so `CLAUDE_API_KEY` is not used by this workflow. Google OAuth credentials
and the stable token encryption key from `GOOGLE_BUSINESS_SETUP.md` are still
needed for real profiles. SerpAPI and a Google Maps API key are not used.

The owner must set their own WhatsApp alert number in Business Settings using an
international country code, such as `+919876543210`. The server no longer guesses
a country for numbers without a prefix. `FRONTEND_URL` must be reachable on the
owner's phone; `localhost` on a phone points to the phone, not your development
computer. Use a public development URL or deployment for phone approval tests.

## Twilio Sandbox testing

1. Enable the Twilio WhatsApp Sandbox in your Twilio account.
2. From the intended recipient's WhatsApp, send Twilio's displayed
   `join <sandbox-code>` message to the Sandbox number. Use the code from Twilio's
   console; a recovery code is not a sandbox join code.
3. Set the sandbox sender in `TWILIO_WHATSAPP_NUMBER` and use that recipient's
   international number in business settings.
4. In development, the app can send free-form alert text without a Content SID
   while the recipient has an active 24-hour customer-service window. Outside
   that window, WhatsApp requires an approved template; sandbox templates and
   their permitted use remain subject to Twilio's sandbox rules.
5. Inspect Twilio message logs for delivery and enrollment/window errors. Sandbox
   joining and a recent inbound message are separate from having API credentials.

## Production WhatsApp templates

Business-initiated alerts can arrive outside the 24-hour window. In production,
the app therefore requires `TWILIO_REVIEW_ALERT_CONTENT_SID` and sends with
`contentSid` / `contentVariables`, without a free-form `body`.

Create and obtain approval for a WhatsApp text template appropriate for review
alerts. Use these variables:

| Variable | Value supplied by this app |
|---|---|
| `{{1}}` | Business name |
| `{{2}}` | Reviewer name |
| `{{3}}` | Star rating |
| `{{4}}` | Review comment (up to 500 characters) |
| `{{5}}` | Full link to review and approve in the app |

For example, your template can say that the business received a review with the
supplied rating and invite the owner to review/respond at the supplied link.
Template approval/category and sender/recipient eligibility are controlled by
Twilio and WhatsApp. If you use a dynamic URL button instead of a full URL in
text, adapt the template-variable mapping accordingly before sending.

## Test without a real business or outgoing messages

Use the existing development demo (`NODE_ENV=development`,
`GOOGLE_BUSINESS_MOCK=true`). In **Reviews → Test a new customer review**:

- Set threshold 3 in Business Settings, then simulate a 3-star review: a simulated
  WhatsApp preview and local AI draft should appear.
- Simulate 4 stars: the review is stored but no alert is triggered.
- Change the threshold to 4 and simulate 4 stars: an alert/draft should appear and
  the reply editor should be available for that review.
- Edit the draft and save the local demo reply. No Google reply is sent, and demo
  AI text requires no external AI key. WhatsApp stays simulated unless you enable
  and select the optional real test described below.

## Optional: receive a real WhatsApp alert from a demo review

This test does not require a real Google business. Set these in `server/.env`:

```dotenv
NODE_ENV=development
GOOGLE_BUSINESS_MOCK=true
DEMO_WHATSAPP_ENABLED=true
```

Keep your Twilio credentials and sender configured as above, then restart the
backend and refresh the app. Save your enrolled WhatsApp number, including its
country code, as Demo Cafe's alert number in **Settings → Business Settings**.

1. Open **Reviews → Test a new customer review**.
2. Select a customer rating at or below the business's saved alert threshold.
   For ratings strictly below 4, set the threshold to 3. A threshold of 4 includes
   4-star reviews too; any threshold from 1 through 5 is supported.
3. Select the unchecked **Send a real WhatsApp test to [your number]** checkbox.
4. Click **Simulate review & test WhatsApp**. The server saves the synthetic review
   and draft, and submits a labeled **DEMO TEST** alert to the business's saved
   number through Twilio. The request cannot override the recipient number.
5. Look for `accepted` on the review card and check your phone. If delivery fails,
   inspect the Message SID in Twilio logs. Provider acceptance is not proof of
   phone delivery. Failed submissions use the existing bounded retry queue.

The checkbox resets after submission and when switching businesses. Leaving it
unchecked still produces only a local alert preview, even with the environment
switch enabled. Above-threshold reviews never trigger WhatsApp sends. The initial
125 demo reviews never send WhatsApp alerts, and demo AI drafts still need no AI
key. Clicking approval on a demo always saves locally; it never posts to Google.

The switch works only with both explicit development mode and the Google demo
flag. Setting it in production cannot enable demo endpoints. Turn it off when
finished. Disabling it pauses unsent opted-in demo alerts; reenabling it allows
those queued retries to resume. Old local-only previews are never upgraded to
real messages by enabling the switch.

A joined Twilio Sandbox recipient and an active customer-service window (or an
applicable approved template) are still required. Twilio may charge for real
messages. `FRONTEND_URL=localhost` lets you test delivery but an approval link
opened on your phone needs a public frontend URL.

Simulated reviews persist across subsequent demo syncs. Demo endpoints remain
unavailable in production. Validating real Google fetching and the production
workflow still requires an authorized real Business Profile. The optional test
above checks WhatsApp delivery without one; do not create a fake Google business.

Automated backend tests mock Google, AI, and Twilio transports. They cover silent
initial import, threshold boundaries, retry without new reviews, overlapping
workers, AI failure, owner authorization/approval, duplicate submission guards,
Google failure/retry, persistent demo events, opted-in demo delivery, recipient
checks, paused retries, and template payloads. No real provider messages are sent
during the tests.

References:
- https://www.twilio.com/docs/whatsapp/sandbox
- https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates
