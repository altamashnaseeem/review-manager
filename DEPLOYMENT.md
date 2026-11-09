# Deployment on Render or Railway

The code is prepared for staging, but a public paid launch still needs rotated
credentials and real end-to-end validation of Google, WhatsApp, and Razorpay.
Automated tests use isolated databases and mocked providers; they do not certify
your provider accounts, production quotas, or live delivery.

## How the poller runs

After MongoDB connects and the backend begins listening, review polling runs
**immediately once**. It then starts another check every
`REVIEW_POLL_INTERVAL_MINUTES`. For a value of `1`, checks are scheduled every
60 seconds. The alert retry queue runs immediately and every 60 seconds
independently. Slow runs do not overlap: if a previous check is still running,
that interval tick is skipped.

The browser does not have to remain open. The backend process must remain alive.
An app restart triggers another immediate check. This is not an exact delivery
SLA: Google publishing delays, the number of businesses/pages, API quota, and
Twilio delivery can add time. Only newly discovered qualifying reviews queue
alerts; the initial historical import is silent.

Use an **always-on** backend. Render free services can sleep; the poller cannot
work while a service is asleep. Disable Railway Serverless/App Sleeping for the
backend. Use one backend replica with `RUN_REVIEW_POLLER=true`. Do not enable the
in-process poller independently in several replicas. If you later separate a
worker, set `RUN_REVIEW_POLLER=false` in web replicas and run exactly one poller
process. `RUN_REVIEW_POLLER=false` disables both scheduled review and alert work
in that process; it does not prevent a user-requested sync.

## Before storing deployment secrets

Rotate every secret that was pasted or exposed: MongoDB password, JWT secret,
Google OAuth client secret, Groq key, Twilio token/recovery credentials, and
Razorpay key secret. Rotating the JWT secret signs out existing sessions. Never
copy real values into `.env.example`, GitHub, screenshots, or chat. Remove unused
SerpAPI/Google Maps keys and the unused Claude API key from this app's environment.
A Twilio recovery code is not an application credential.

Use one entry per environment variable. The `.env` in the conversation is a local
development configuration, not a production file. Production must set:

```dotenv
NODE_ENV=production
GOOGLE_BUSINESS_MOCK=false
DEMO_WHATSAPP_ENABLED=false
RUN_REVIEW_POLLER=true
REVIEW_POLL_INTERVAL_MINUTES=1
TRUST_PROXY_HOPS=1
```

The last setting assumes exactly one trusted reverse proxy, as in the standard
Render/Railway web-service setup. Use the correct hop count for your actual
network; never set Express trust proxy to unconditional `true`.

Generate a new JWT secret locally, and store it in the provider's secret settings:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Generate `GOOGLE_TOKEN_ENCRYPTION_KEY` once:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the token encryption key stable across deployments and back it up securely.
Changing or losing it requires Google reconnection. No server secret may use a
`NEXT_PUBLIC_` prefix.

## Backend service

Deploy `altamashnaseeem/review-manager` after reviewing/merging the PR, or select
`codex/google-business-reviews` explicitly for staging. The changes are not in
`main` until merged.

| Setting | Render | Railway |
|---|---|---|
| Service | Node web service | Persistent Node service |
| Root directory | `server` | `/server` |
| Node | 24 | 24 (Node engine is in package.json) |
| Build command | `npm ci --omit=dev` | `npm ci --omit=dev` |
| Start command | `npm start` | `npm start` |
| Health check | `/health` | `/health` |
| Scaling | One always-on instance | One replica, sleeping disabled |

Set secrets from `server/.env.production.example` through the hosting UI, filling
all empty required values. Let the platform provide `PORT`; the server listens
on `0.0.0.0`. For Render, set `NODE_VERSION=24` if needed to select the runtime.

- `MONGO_URI`: a MongoDB database/user for the intended environment. Configure
  Atlas network access for the backend's outbound network. Use a separate staging
  database; do not test migrations or provider events on production data.
- `FRONTEND_URL`: the exact public HTTPS frontend origin, without a page path.
- `GOOGLE_REDIRECT_URI`: `https://YOUR_BACKEND/api/business/google/callback`.
  Register the exact same URI in Google Cloud.
- Configure Google API access approval, OAuth consent/verification, Groq, and a
  production WhatsApp sender/template as explained in the linked setup guides.
  A Twilio sandbox sender is a development tool, not a public launch setup.

The server refuses development-mode startup on Render/Railway, invalid production
config, enabled demo switches, local HTTP
URLs, missing/invalid encryption keys, and missing production integrations. You
can preflight configuration from the `server` directory with:

```sh
npm run check:config
```

This reports variable names/errors without printing secret values. `/health`
returns 200 only when MongoDB is connected; it returns 503 otherwise.
`/health/live` indicates that the HTTP process responds. Set up ongoing health
and error-log monitoring in the hosting platform. The process drains requests,
stops scheduled work, and disconnects MongoDB on SIGTERM/SIGINT.

## Frontend service

Create a second Node service with root directory `frontend` (Render) or
`/frontend` (Railway), using Node 24.

```text
Build: npm ci --include=dev && npm run lint && npm run build:deploy
Start: npm start
```

Set this before building:

```dotenv
NEXT_PUBLIC_API_URL=https://YOUR_BACKEND/api
```

The value is embedded in the client build: changing it requires rebuilding the
frontend. `build:deploy` rejects missing, localhost, non-HTTPS, or incorrectly
formatted API URLs. Local `npm run build` remains available for localhost browser
tests. Update the backend's `FRONTEND_URL` to the resulting frontend origin and
redeploy/restart it. Phone approval links need this public URL; `localhost` on a
phone points to the phone itself.

This branch upgrades Next.js/React and requires Node 22 or 24. Node 24 is the
recommended deployment runtime. Clean installs must use the committed lockfiles.
Security overrides for transitive minimatch/glob and matching React-is are in the
package manifests; review/remove them when upstream dependencies resolve them.

## Paid subscriptions

Billing is **off by default** (`BILLING_ENABLED=false`). Seven-day trials still
work; expired trials are blocked at the API and skipped by background jobs.
Do not enable paid checkout merely because Razorpay keys are present. Disabling
this switch stops new checkout; it does not cancel provider subscriptions. Keep
the keys and webhook configured for existing subscribers: signed lifecycle
events, pending payment verification, and status refresh continue to reconcile
existing subscriptions while new checkout is disabled.

1. In Razorpay test mode, create all three plans. Use keys and plan IDs from the
   same account/mode. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_PLAN_MONTHLY_ID`, `RAZORPAY_PLAN_QUARTERLY_ID`, and
   `RAZORPAY_PLAN_SEMI_ANNUAL_ID`. Use three distinct INR plans with period
   `monthly` and intervals `1`, `3`, and `6`, respectively. Both pricing screens
   read the actual amounts through `GET /api/billing/plans`; there are no
   hard-coded fallback prices. Invalid or unavailable plans disable checkout
   until corrected. Each subscription has a maximum of 12 billing cycles.
2. Generate a separate random `RAZORPAY_WEBHOOK_SECRET`, then configure a webhook
   at `https://YOUR_BACKEND/api/payments/razorpay/webhook` using that same secret.
3. Subscribe to the relevant subscription lifecycle events, including
   authenticated, activated, charged, pending, halted, cancelled, and completed.
4. Set `BILLING_ENABLED=true`. Production configuration now requires the Razorpay
   values and webhook secret. Test checkout, initial authorization, activation,
   paid-period expiry, a failed attempt followed by a successful retry in the
   same checkout, cancellation, and webhook retries.
5. For public paid launch, switch to live keys/plan IDs and configure the live-mode
   webhook. Authentication of a future subscription is not an immediate paid
   entitlement; active verified status and an unexpired paid period are needed.

Checkout is authenticated and bound to the logged-in user. Payment callbacks
are HMAC-verified using the server-stored subscription ID, then the server fetches
the current subscription from Razorpay. Signed webhooks also fetch current
provider state rather than applying stale event payloads, so replays/out-of-order
events do not restore expired access. Callback success alone never grants access;
the provider must report at least one paid charge and a future paid-period end.

Paid access is stored separately from an unfinished checkout. Creating or
authorizing a new subscription preserves the remaining verified paid time and
sets the new subscription's start after it. Reopening the same unfinished plan
reuses its subscription. Choosing another plan cancels the old unpaid checkout
and confirms its cancellation before creating a replacement. Already authorized
subscriptions cannot be replaced through this flow.

The `BillingSubscription` collection retains ownership of old provider IDs so
late callbacks and webhooks can still be verified after replacement. Backend
startup creates its unique provider-ID index before serving requests; the MongoDB
user needs index-creation permission. Existing linked subscriptions are adopted
when reconciled; no destructive database migration is needed. If an older app
version already overwrote a paid subscription ID, an administrator must reconcile
the original provider ID with its owner before that lost history can be recovered.

Cancelled subscriptions retain access only until their verified paid-through
date. Existing paid labels without verified provider status and expiry do not
grant access. Reconcile a linked legacy subscription through the authenticated
`POST /api/checkout/status` endpoint; the **Refresh subscription status** button is
available once the account has a linked subscription. Changes
or cancellation of authorized subscriptions currently require administration in Razorpay;
this version does not provide a self-service cancellation page.

## Required staging acceptance checks

- Register and log in; verify the production frontend uses the hosted backend.
- Connect an authorized Google owner/manager of a verified business, select the
  correct location, and compare the imported review count. Confirm token refresh.
- Set a chosen threshold, get a new real review, and verify that only qualifying
  new ratings alert the owner. Confirm successful phone delivery in Twilio logs.
- Open the WhatsApp link on a phone, log in, approve/edit, and verify the exact
  reply appears on Google. Dismissing a review must not post anything.
- Complete a Razorpay test transaction and lifecycle checks if billing is enabled.
- Restart the backend and close all browsers; check platform logs to confirm the
  poller continues. Confirm no duplicate historical alerts after restart.
- Confirm demo endpoints are unavailable, production secrets are rotated, and
  backup/recovery and monitoring are configured.

Account recovery/email verification and a self-service subscription management
page are not implemented in this version. Plan those customer-support flows
before an unattended public launch.

Only after these checks pass should you open the app to paying business owners.
No hosting purchase, live deployment, real payment, WhatsApp message, or Google
reply is performed by the automated tests.

See [GOOGLE_BUSINESS_SETUP.md](GOOGLE_BUSINESS_SETUP.md) and
[REVIEW_ALERTS_SETUP.md](REVIEW_ALERTS_SETUP.md) for provider-specific instructions.
