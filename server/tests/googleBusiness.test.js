import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { google } from 'googleapis';

process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'integration-test-secret-not-for-production';
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/business/google/callback';
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.GOOGLE_BUSINESS_MOCK = 'true';

const { default: app } = await import('../app.js');
const { default: Business } = await import('../models/Business.js');
const { default: Review } = await import('../models/Review.js');
const { BUSINESS_SCOPE, encryptToken, decryptToken, collectPages, listGoogleLocations, fetchBusinessReviews, googleRequest } = await import('../services/googleServices.js');
const { syncBusinessReviews } = await import('../services/reviewSync.js');
const { demoReviewPage } = await import('../fixtures/googleBusiness.js');
let mongo, server, base, owner, other, business;
async function call(path, { token = owner?.token, method = 'GET', body, redirect } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), ...(redirect ? { redirect } : {}),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null, headers: response.headers };
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Business.init(); await Review.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  owner = (await call('/auth/register', { token: null, method: 'POST', body: { name: 'Developer', email: 'developer@example.com', password: 'password123', phone: '+15555555555' } })).data;
  other = (await call('/auth/register', { token: null, method: 'POST', body: { name: 'Other', email: 'other@example.com', password: 'password123', phone: '+15555555556' } })).data;
});
after(async () => {
  mock.restoreAll();
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Google Business integration', async t => {
  await t.test('creates drafts without a Place ID and blocks reviews before connection', async () => {
    const result = await call('/business', { method: 'POST', body: { name: 'Cafe', alertPhone: '+15555555555' } });
    assert.equal(result.status, 201);
    business = result.data.business;
    assert.equal(business.googleConnected, false);
    assert.equal((await call(`/reviews/${business._id}`)).data.code, 'GOOGLE_CONNECTION_REQUIRED');
    assert.equal((await call(`/reviews/${business._id}/stats`)).status, 409);
    const update = await call(`/business/${business._id}`, { method: 'PUT', body: { googleConnected: true, googleAuthorized: true, isDemo: true, googleAccessToken: 'injected', owner: other.user.id, alertOnRating: 2 } });
    assert.equal(update.data.business.googleConnected, false);
    assert.equal(update.data.business.isDemo, false);
    assert.equal(update.data.business.owner, owner.user.id);
    assert.equal(update.data.business.alertOnRating, 2);
    assert.equal('googleAccessToken' in update.data.business, false);
    assert.equal((await call(`/business/${business._id}/google/connect`, { token: other.token })).status, 404);
  });

  let auth;
  await t.test('starts OAuth with opaque state, consent, offline access, PKCE, and no-store', async () => {
    const result = await call(`/business/${business._id}/google/connect`);
    assert.equal(result.status, 200);
    auth = { ...result.data, state: new URL(result.data.url).searchParams.get('state') };
    const params = new URL(auth.url).searchParams;
    assert.equal(params.get('access_type'), 'offline');
    assert.equal(params.get('prompt'), 'consent');
    assert.equal(params.get('scope'), BUSINESS_SCOPE);
    assert.equal(params.get('code_challenge_method'), 'S256');
    assert.ok(params.get('code_challenge'));
    assert.ok(auth.codeVerifier);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(auth.state.includes(owner.user.id), false);
  });
  await t.test('public callback accepts Google redirect without JWT and relays only valid state', async () => {
    const response = await fetch(`${base}/api/business/google/callback?code=test-code&state=${auth.state}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location'));
    assert.equal(url.pathname, '/connect-google');
    assert.equal(url.searchParams.get('code'), 'test-code');
    assert.equal(url.searchParams.get('business'), business._id);
    const invalid = await fetch(`${base}/api/business/google/callback?code=test-code&state=forged`, { redirect: 'manual' });
    assert.equal(new URL(invalid.headers.get('location')).searchParams.get('error'), 'invalid_state');
    const denied = await fetch(`${base}/api/business/google/callback?error=access_denied&state=${auth.state}`, { redirect: 'manual' });
    assert.equal(new URL(denied.headers.get('location')).searchParams.get('error'), 'access_denied');
  });
  await t.test('only original owner can exchange code; state is single use; tokens are encrypted and never returned', async () => {
    const body = { code: 'test-code', state: auth.state, codeVerifier: auth.codeVerifier };
    assert.equal((await call(`/business/${business._id}/google/complete`, { token: other.token, method: 'POST', body })).status, 400);
    const tokenMock = mock.method(google.auth.OAuth2.prototype, 'getToken', async function(options) {
      assert.equal(options.codeVerifier, auth.codeVerifier);
      return { tokens: { access_token: 'secret-access', refresh_token: 'secret-refresh', scope: BUSINESS_SCOPE, expiry_date: Date.now() - 1000 } };
    });
    const result = await call(`/business/${business._id}/google/complete`, { method: 'POST', body });
    assert.equal(result.status, 200);
    assert.equal(result.data.business.googleAuthorized, true);
    assert.equal(result.data.business.googleConnected, false);
    assert.equal(JSON.stringify(result.data).includes('secret-'), false);
    const stored = await Business.findById(business._id).select('+googleAccessToken +googleRefreshToken');
    assert.ok(stored.googleRefreshToken.startsWith('v1:'));
    assert.equal(decryptToken(stored.googleRefreshToken), 'secret-refresh');
    assert.equal(JSON.stringify(stored).includes('googleRefreshToken'), false);
    assert.equal((await call(`/business/${business._id}/google/complete`, { method: 'POST', body })).status, 400);
    tokenMock.mock.restore();
  });

  await t.test('paginates accounts and locations, requests readMask, and supports no locations', async () => {
    const seen = [];
    const locations = await listGoogleLocations(business, async (_b, options) => {
      seen.push(options);
      if (options.url.endsWith('/accounts')) return options.params.pageToken ? { accounts: [{ name: 'accounts/2' }] } : { accounts: [{ name: 'accounts/1' }], nextPageToken: 'account-page-2' };
      assert.ok(options.params.readMask.includes('name,title'));
      if (options.url.includes('accounts/1')) return options.params.pageToken ? { locations: [{ name: 'locations/12', title: 'Cafe 12' }] } : { locations: [{ name: 'locations/11', title: 'Cafe 11' }], nextPageToken: 'location-page-2' };
      return { locations: [{ name: 'locations/21', title: 'Cafe 21' }] };
    });
    assert.deepEqual(locations.map(l => l.locationId), ['11', '12', '21']);
    assert.equal(seen.length, 5);
    assert.deepEqual(await listGoogleLocations(business, async () => ({ accounts: [] })), []);
  });

  const googleMock = mock.method(google.auth.OAuth2.prototype, 'request', async function(options) {
    if (options.url.endsWith('/accounts')) return { data: { accounts: [{ name: 'accounts/123', accountName: 'Test account' }] } };
    if (options.url.includes('businessinformation')) return { data: { locations: [{ name: 'locations/456', title: 'Managed Cafe', metadata: { placeId: 'real-place-id' } }] } };
    assert.equal(options.params.pageSize, 50);
    return { data: demoReviewPage('google-fixture', options.params.pageToken) };
  });
  await t.test('rejects unauthorized locations; selects verified accessible location and imports every review page', async () => {
    assert.equal((await call(`/business/${business._id}/google/location`, { method: 'POST', body: { accountId: '123', locationId: 'forged' } })).status, 403);
    await Review.create({ business: business._id, googleReviewId: 'old-serp-review', rating: 3, reviewDate: new Date() });
    const result = await call(`/business/${business._id}/google/location`, { method: 'POST', body: { accountId: '123', locationId: '456' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.business.googleConnected, true);
    assert.equal(result.data.business.reviewsSynced, true);
    assert.equal(result.data.business.name, 'Managed Cafe');
    assert.equal(await Review.countDocuments({ business: business._id }), 125);
    assert.equal(await Review.countDocuments({ business: business._id, alertSent: true }), 0);
    assert.equal(await Review.countDocuments({ business: business._id, aiSuggestedReply: { $ne: null } }), 0);
    assert.equal((await call(`/reviews/${business._id}?limit=50&page=3`)).data.reviews.length, 25);
    assert.equal((await call(`/reviews/${business._id}/stats`)).data.stats.totalReviews, 125);
    const stored = await Business.findById(business._id);
    await syncBusinessReviews(stored);
    assert.equal(await Review.countDocuments({ business: business._id }), 125);
    assert.equal(await Review.countDocuments({ business: business._id, replyStatus: 'posted' }), 1);
    assert.equal((await call(`/business/${business._id}/google/sync`, { token: other.token, method: 'POST', body: {} })).status, 404);
  });
  googleMock.mock.restore();

  await t.test('refreshes expired access token using Google OAuth client and persists new encrypted tokens', async () => {
    const tokenMock = mock.method(google.auth.OAuth2.prototype, 'refreshTokenNoCache', async function(refreshToken) {
      assert.equal(refreshToken, 'secret-refresh');
      return { tokens: { access_token: 'renewed-access', expiry_date: Date.now() + 3600000 } };
    });
    // Keep the real OAuth2 request method so its refresh logic runs; replace only HTTP transport.
    const probe = new google.auth.OAuth2();
    const transportMock = mock.method(Object.getPrototypeOf(probe.transporter), 'request', async options => {
      assert.equal(options.headers.get('authorization'), 'Bearer renewed-access');
      return { data: { refreshed: true }, status: 200 };
    });
    const result = await googleRequest(business, { url: 'https://mybusiness.googleapis.com/v4/test' });
    assert.equal(result.refreshed, true);
    assert.equal(tokenMock.mock.callCount(), 1);
    const stored = await Business.findById(business._id).select('+googleAccessToken');
    assert.equal(decryptToken(stored.googleAccessToken), 'renewed-access');
    transportMock.mock.restore(); tokenMock.mock.restore();
  });
  await t.test('revoked permission clears connected state and gives a reconnect message', async () => {
    const requestMock = mock.method(google.auth.OAuth2.prototype, 'request', async () => { throw { response: { status: 401 } }; });
    await assert.rejects(googleRequest(business, { url: 'https://mybusiness.googleapis.com/v4/test' }), /Reconnect/);
    assert.equal((await Business.findById(business._id)).googleConnected, false);
    requestMock.mock.restore();
  });
  await t.test('failed initial sync preserves legacy data and blocks dashboard; missing scope is rejected', async () => {
    const created = (await call('/business', { method: 'POST', body: { name: 'Retry Cafe', alertPhone: '+15555555555' } })).data.business;
    const flow = (await call(`/business/${created._id}/google/connect`)).data;
    const tokenMock = mock.method(google.auth.OAuth2.prototype, 'getToken', async () => ({ tokens: { access_token: 'access', refresh_token: 'refresh', scope: 'email' } }));
    const denied = await call(`/business/${created._id}/google/complete`, { method: 'POST', body: { code: 'code', codeVerifier: flow.codeVerifier, state: new URL(flow.url).searchParams.get('state') } });
    assert.equal(denied.status, 403);
    assert.equal((await Business.findById(created._id)).googleAuthorized, false);
    tokenMock.mock.restore();
    const retry = await Business.findById(created._id);
    retry.googleAccountId = 'retry-account'; retry.googleLocationId = 'retry-location'; retry.googleConnected = true;
    retry.googleRefreshToken = encryptToken('retry-refresh');
    await retry.save();
    await Review.create({ business: retry._id, googleReviewId: 'legacy-preserved', rating: 2, reviewDate: new Date() });
    const requestMock = mock.method(google.auth.OAuth2.prototype, 'request', async () => { throw { response: { status: 403 } }; });
    const result = await call(`/business/${retry._id}/google/sync`, { method: 'POST', body: {} });
    assert.equal(result.status, 403);
    assert.equal((await Business.findById(retry._id)).reviewsSynced, false);
    assert.equal(await Review.countDocuments({ business: retry._id }), 1);
    assert.equal((await call(`/reviews/${retry._id}/stats`)).status, 409);
    requestMock.mock.restore();
  });
  await t.test('Google edits are updated without duplicates and bad pagination input is rejected', async () => {
    const stored = await Business.findById(business._id);
    stored.googleConnected = true; await stored.save();
    const requestMock = mock.method(google.auth.OAuth2.prototype, 'request', async function(options) {
      const page = demoReviewPage('google-fixture', options.params.pageToken);
      page.reviews[0].comment = 'Edited on Google';
      return { data: page };
    });
    await syncBusinessReviews(stored);
    assert.equal(await Review.countDocuments({ business: stored._id }), 125);
    assert.equal((await Review.findOne({ business: stored._id, googleReviewId: 'demo-google-fixture-1' })).comment, 'Edited on Google');
    assert.equal((await call(`/reviews/${stored._id}?page=-1`)).status, 400);
    requestMock.mock.restore();
  });

  await t.test('demo imports 125 reviews, simulates replies, and is forbidden in production', async () => {
    const created = await call('/business', { method: 'POST', body: { name: 'Demo Cafe', alertPhone: '+15555555555' } });
    const id = created.data.business._id;
    const connected = await call(`/business/${id}/google/demo`, { method: 'POST', body: {} });
    assert.equal(connected.status, 200);
    assert.equal(connected.data.business.isDemo, true);
    const reviews = (await call(`/reviews/${id}`)).data.reviews;
    assert.equal((await call(`/reviews/${id}`)).data.total, 125);
    const reply = await call(`/reviews/${reviews[0]._id}/post-reply`, { method: 'POST', body: { finalReply: 'Demo thanks' } });
    assert.equal(reply.status, 200);
    assert.match(reply.data.message, /nothing was posted/);
    assert.equal(reply.data.review.replyStatus, 'posted');
    const ai = await call(`/reviews/${reviews[0]._id}/regenerate`, { method: 'POST', body: {} });
    assert.match(ai.data.aiSuggestedReply, /Demo reply/);
    process.env.NODE_ENV = 'production';
    assert.equal((await call(`/business/${id}/google/demo`, { method: 'POST', body: {} })).status, 404);
    assert.equal((await call(`/reviews/${id}`)).status, 409);
    process.env.NODE_ENV = 'development';
  });
  await t.test('rejects expired OAuth states and duplicate pagination tokens', async () => {
    const flow = (await call(`/business/${business._id}/google/connect`)).data;
    await Business.updateOne({ _id: business._id }, { googleOAuthExpiresAt: new Date(Date.now() - 1) });
    assert.equal((await call(`/business/${business._id}/google/complete`, { method: 'POST', body: { code: 'code', codeVerifier: flow.codeVerifier, state: new URL(flow.url).searchParams.get('state') } })).status, 400);
    await assert.rejects(collectPages(async () => ({ reviews: [], nextPageToken: 'same-token' }), 'reviews'), /repeated/);
    const encrypted = encryptToken('sensitive');
    assert.equal(decryptToken(encrypted), 'sensitive');
    assert.notEqual(encryptToken('sensitive'), encrypted);
    const parts = encrypted.split(':'); parts[3] = Buffer.from('tampered').toString('base64');
    assert.throws(() => decryptToken(parts.join(':')));
  });
});
