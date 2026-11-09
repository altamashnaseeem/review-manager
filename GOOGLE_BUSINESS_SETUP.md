# Google Business Profile reviews

The app now uses Google Business Profile APIs instead of SerpAPI. The flow is:
create account → business details → Google consent → select a managed location →
initial review sync → dashboard. Existing users must reconnect once to complete
this setup. A Place ID is no longer required in the business form.

## Google Cloud configuration

1. Use one Google Cloud project for the APIs and the OAuth web application.
   Request Business Profile API access and check that your project has approval
   and usable quota. Enabling an API alone does not guarantee access.
2. Enable **My Business Account Management API** and **My Business Business
   Information API** for account/location discovery. Reviews and replies use the
   **Google My Business API**, at `mybusiness.googleapis.com/v4`. This API is only
   visible after Google approves access. Follow Google's full API setup guidance
   for any additional required APIs.
3. Configure the OAuth consent screen with scope
   `https://www.googleapis.com/auth/business.manage`. While the app is in Testing,
   add the Google accounts that will connect as OAuth test users. Production use
   may require OAuth verification and Google Business Profile API approval.
4. Create an OAuth client of type **Web application**. Register the exact backend
   callback URI, for example
   `http://localhost:5000/api/business/google/callback` locally and
   `https://api.example.com/api/business/google/callback` for production. Match the
   scheme, host, port, and path exactly. This is not the frontend page URL.
5. Copy `server/.env.example` to `server/.env`. Set `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `MONGO_URI`, and
   `JWT_SECRET`. Generate `GOOGLE_TOKEN_ENCRYPTION_KEY` with the command in the
   example. Set `frontend/.env.local` from `frontend/.env.example`, pointing
   `NEXT_PUBLIC_API_URL` at your backend's `/api`. Never use `NEXT_PUBLIC_` for the
   client secret or token encryption key. An API key is not used for these calls.
6. Use HTTPS and `NODE_ENV=production` in production. Keep the encryption key
   stable across deploys. Losing/changing it requires reconnecting Google accounts.

## Run locally

Use Node.js 22 or 24 and MongoDB. In `server`, run `npm ci` then `npm run dev`.
In `frontend`, run `npm ci` then `npm run dev`. Open `http://localhost:3000`.

Sign up, enter the business name and alert number, click **Connect Google Business
account**, grant permission, and choose the correct location. The selected
location is checked against Google's accessible locations on the server. All
review pages are fetched with Google's maximum page size of 50; there is no fixed
page-count cap. The first import suppresses historical WhatsApp/AI alerts.

The OAuth redirect returns to the same browser tab. The frontend holds the PKCE
verifier in sessionStorage and completes the code exchange using the original
owner's app login. Start again if the tab/session is lost. The callback itself is
public because Google cannot send the app's JWT; state is short lived, single use,
and bound to the owner during the authenticated completion request. Tokens are
stored encrypted in MongoDB, excluded from API responses, and refreshed by the
Google OAuth client. Standard business updates cannot set connection flags,
tokens, ownership, or Google resource IDs.

## Test without owning a store

Google does **not** provide a Business Profile sandbox or test business/review
fixtures. OAuth test users only bypass the consent-screen audience restriction;
they do not receive business ownership or manager access. `validateOnly` on other
supported operations does not simulate the reviews-list endpoint.

For local testing, set these in `server/.env` and restart the backend:

```dotenv
NODE_ENV=development
GOOGLE_BUSINESS_MOCK=true
```

Create a new business and choose **Use development demo**. It imports **125
synthetic reviews** through three pages, opens the dashboard, supports filters
and local reply simulation, and displays a persistent demo banner. It requires
MongoDB and the app login, but no Google credentials, store, Groq, or Twilio.
Demo replies never call Google and AI suggestions are fixed synthetic text.
WhatsApp messages are simulated by default. An explicitly enabled real WhatsApp
test option is documented in [REVIEW_ALERTS_SETUP.md](REVIEW_ALERTS_SETUP.md).
Demo endpoints and demo review access are disabled outside explicit development mode, even if the mock flag is true. Create a
separate business when you are ready to connect a real profile.

For real end-to-end validation, ask an actual owner of a verified Business Profile
to connect their account to your app, or invite your Google account as a manager
in Business Profile settings. You do not have to own the store. Use that Google
account as an OAuth test user while your consent screen is in Testing. First
check account discovery, location selection, review totals, and subsequent syncs.
Only post a real reply with the owner's explicit consent: Google has no dry-run
review-reply endpoint. Do not create a fake public business to test.

## Existing data and rollout

Deploy the backend and frontend from this branch together. MongoDB must allow the
new sparse unique index on `businesses.googleResourceName` (or create the index
manually if production disables Mongoose auto-indexing). No existing index needs
to be dropped. New drafts have an internal unique placeholder in the legacy
`googlePlaceId` field until Google supplies a Place ID. The selected Google
location is unique in this installation.

Existing plaintext tokens can be read during migration and are encrypted on the
next successful Google request/reconnection; reconnect existing users before
using the dashboard. Legacy SerpAPI review records for a business are replaced
only after a successful Google import; those records used different review IDs.
Old SerpAPI reply drafts/dismissals are not transferred to the new Google review
IDs. Google's existing owner replies are imported. New Google reviews and edits
are upserted by stable review ID, so repeated syncs do not create duplicates.

Set `GOOGLE_BUSINESS_MOCK=false` and `NODE_ENV=production` for the deployed app.
There is no need to retain `SERPAPI_KEY`. Existing unrelated AI, billing, and
notification environment variables remain applicable.

## Common failures

- **No managed locations:** use the Google account that manages the profile or
  obtain a real manager invitation; consent alone cannot grant location access.
- **403 / quota zero:** check API access approval, enabled APIs, project quotas,
  and location permissions. Reviews require a verified location.
- **Permission declined:** restart connection and grant Business Profile scope.
- **Redirect mismatch:** match the backend callback URI exactly in Google Cloud.
- **Expired/revoked access:** reconnect. Refresh tokens for external apps left in
  OAuth Testing can expire after seven days for this scope; test-user status is
  not permanent offline access.
- **Sync failed:** stay on onboarding and retry. The dashboard/review API requires
  connection, selected location, and a completed initial sync.

For the rating-triggered WhatsApp alerts, AI drafts, and owner approval workflow,
see [REVIEW_ALERTS_SETUP.md](REVIEW_ALERTS_SETUP.md).

## Automated checks

```sh
cd server
npm ci
npm test
cd ../frontend
npm ci
npm run build
```

Backend integration tests use an ephemeral MongoDB through
`mongodb-memory-server`; the first run downloads a MongoDB binary. They mock
Google's HTTP transport and exercise owner checks, single-use OAuth state, PKCE,
token encryption/refresh, location discovery, full pagination, idempotent imports,
review gating, local replies, and production demo restrictions. They do not
prove your Cloud project approval, credentials, or live location access.

Official references:
- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply

For production hosting on Render/Railway, configuration checks, and billing, see
[DEPLOYMENT.md](DEPLOYMENT.md).
