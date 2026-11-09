import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { google } from 'googleapis';

Object.assign(process.env, {
  NODE_ENV: 'development', JWT_SECRET: 'deployment-tests-only', BILLING_ENABLED: 'false',
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/business/google/callback', GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  RAZORPAY_KEY_ID: 'rzp_test_dummy', RAZORPAY_KEY_SECRET: 'test-payment-secret', RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret',
  RAZORPAY_PLAN_MONTHLY_ID: 'plan_monthly', RAZORPAY_PLAN_QUARTERLY_ID: 'plan_quarterly', RAZORPAY_PLAN_SEMI_ANNUAL_ID: 'plan_semi',
});
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');
const { default: Business } = await import('../models/Business.js');
const { default: Review } = await import('../models/Review.js');
const { billingApi } = await import('../services/billingService.js');
const { hasReviewAccess } = await import('../services/subscriptionAccess.js');
const { validateEnvironment } = await import('../config/environment.js');
const { startReviewPoller, pollAllBusinesses } = await import('../jobs/reviewPoller.js');
const { processReviewAlerts } = await import('../services/reviewAlerts.js');
let mongo, server, base, owner, other;
let creates = 0, fetches = 0;
const subscriptions = new Map();
async function call(path, { token = owner?.token, method = 'GET', body, headers: extra = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
const sign = (body, secret) => createHmac('sha256', secret).update(body).digest('hex');
before(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const create = async name => (await call('/auth/register', { token: null, method: 'POST', body: { name, email: `${name}@deploy.example`, phone: '+15555555555', password: 'test-password123' } })).data;
  owner = await create('owner'); other = await create('other');
  mock.method(billingApi, 'createSubscription', async options => {
    creates++;
    const subscription = { id: `sub_${options.notes.userId}`, status: 'created', plan_id: options.plan_id, notes: options.notes, current_end: null };
    assert.ok(options.start_at > Date.now() / 1000);
    subscriptions.set(subscription.id, subscription);
    return subscription;
  });
  mock.method(billingApi, 'fetchSubscription', async id => { fetches++; if (!subscriptions.has(id)) throw new Error('Unknown mock subscription'); return subscriptions.get(id); });
});
after(async () => { mock.restoreAll(); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); });

test('deployment configuration, poller schedule, access, and billing', async t => {
  await t.test('production configuration rejects demo switches, localhost URLs, and missing token encryption without printing secrets', () => {
    const env = {
      NODE_ENV: 'production', MONGO_URI: 'mongodb://example.invalid/app', JWT_SECRET: randomBytes(32).toString('hex'),
      FRONTEND_URL: 'https://app.example.test', GOOGLE_REDIRECT_URI: 'https://api.example.test/api/business/google/callback',
      GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'), GOOGLE_CLIENT_ID: 'configured', GOOGLE_CLIENT_SECRET: 'secret-not-for-output',
      GROQ_API_KEY: 'configured', TWILIO_ACCOUNT_SID: 'configured', TWILIO_AUTH_TOKEN: 'configured', TWILIO_WHATSAPP_NUMBER: 'whatsapp:+15555555555', TWILIO_REVIEW_ALERT_CONTENT_SID: 'configured',
    };
    assert.equal(validateEnvironment(env).runPoller, true);
    assert.throws(() => validateEnvironment({ ...env, RENDER: 'true', NODE_ENV: 'development' }), /must use NODE_ENV=production/);
    assert.equal(validateEnvironment({ ...env, REVIEW_POLL_INTERVAL_MINUTES: '1' }).pollIntervalMs, 60000);
    assert.throws(() => validateEnvironment({ ...env, GOOGLE_BUSINESS_MOCK: 'true' }), /Disable GOOGLE_BUSINESS_MOCK/);
    assert.throws(() => validateEnvironment({ ...env, FRONTEND_URL: 'http://localhost:3000' }), /FRONTEND_URL/);
    assert.throws(() => validateEnvironment({ ...env, GOOGLE_TOKEN_ENCRYPTION_KEY: '' }), /GOOGLE_TOKEN_ENCRYPTION_KEY/);
    assert.throws(() => validateEnvironment({ ...env, BILLING_ENABLED: 'true' }), /RAZORPAY_WEBHOOK_SECRET/);
    assert.throws(() => validateEnvironment({ ...env, REVIEW_POLL_INTERVAL_MINUTES: '0.5' }), /whole number/);
    try { validateEnvironment({ ...env, FRONTEND_URL: 'http://localhost:3000' }); }
    catch (error) { assert.equal(error.message.includes(env.GOOGLE_CLIENT_SECRET), false); }
  });
  await t.test('poller runs on startup, uses the selected interval, retries alerts every minute, and stops cleanly', async () => {
    let polls = 0, alerts = 0; const timers = [], cleared = [];
    const worker = startReviewPoller({ intervalMinutes: 5, pollReviews: async () => { polls++; }, retryAlerts: async () => { alerts++; },
      setIntervalFn: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearIntervalFn: id => cleared.push(id),
    });
    await new Promise(setImmediate);
    assert.equal(polls, 1); assert.equal(alerts, 1); assert.deepEqual(timers.map(timer => timer.delay), [300000, 60000]);
    await timers[0].callback(); await timers[1].callback(); assert.equal(polls, 2); assert.equal(alerts, 2);
    await worker.stop(); await timers[0].callback(); assert.equal(polls, 2); assert.deepEqual(cleared, [1, 2]);
  });
  await t.test('a slow poll cannot overlap its next interval', async () => {
    let release, polls = 0; const timers = [];
    const pending = new Promise(resolve => { release = resolve; });
    const worker = startReviewPoller({ intervalMinutes: 1, pollReviews: () => { polls++; return pending; }, retryAlerts: async () => {},
      setIntervalFn: callback => { timers.push(callback); return timers.length; }, clearIntervalFn: () => {},
    });
    await new Promise(setImmediate); timers[0](); timers[0](); assert.equal(polls, 1);
    const stopped = worker.stop(); release(); await stopped; assert.equal(polls, 1);
  });
  await t.test('expired trials and unverified paid labels cannot access reviews or run background work', async () => {
    await User.updateOne({ _id: other.user.id }, { plan: 'trial', trialEndsAt: new Date(Date.now() - 1000) });
    const business = await Business.create({ owner: other.user.id, name: 'Expired business', googlePlaceId: 'expired-test-place', alertPhone: '+15555555555', googleConnected: true, reviewsSynced: true });
    await Review.create({ business: business._id, googleReviewId: 'expired-review', rating: 1, reviewDate: new Date(), source: 'google', alertEligible: true, alertStatus: 'pending' });
    assert.equal((await call(`/reviews/${business._id}`, { token: other.token })).data.code, 'SUBSCRIPTION_EXPIRED');
    const googleMock = mock.method(google.auth.OAuth2.prototype, 'request', async () => ({ data: { reviews: [] } }));
    await pollAllBusinesses(); assert.equal(googleMock.mock.callCount(), 0); googleMock.mock.restore();
    let alerts = 0;
    await processReviewAlerts(business, { generateReply: async () => 'Draft', sendAlert: async () => { alerts++; return { sid: 'forbidden' }; } });
    assert.equal(alerts, 0);
    await User.updateOne({ _id: other.user.id }, { plan: 'monthly' });
    assert.equal((await call(`/reviews/${business._id}`, { token: other.token })).status, 403);
    assert.equal(hasReviewAccess(await User.findById(other.user.id)), false);
  });
  await t.test('checkout requires the logged-in owner, can be disabled, and reuses a pending checkout', async () => {
    assert.equal((await call('/checkout/session', { token: null, method: 'POST', body: { plan: 'monthly', userId: owner.user.id } })).status, 401);
    assert.equal((await call('/checkout/session', { method: 'POST', body: { plan: 'monthly' } })).status, 503);
    process.env.BILLING_ENABLED = 'true';
    assert.equal((await call('/checkout/session', { method: 'POST', body: { plan: 'monthly', userId: other.user.id } })).status, 403);
    const created = await call('/checkout/session', { method: 'POST', body: { plan: 'monthly' } });
    assert.equal(created.status, 200); assert.equal(creates, 1);
    const repeated = await call('/checkout/session', { method: 'POST', body: { plan: 'monthly' } });
    assert.equal(repeated.data.subscriptionId, created.data.subscriptionId); assert.equal(creates, 1);
  });
  await t.test('concurrent checkout requests cannot create two subscriptions', async () => {
    const account = (await call('/auth/register', { token: null, method: 'POST', body: { name: 'concurrent', email: 'concurrent@deploy.example', phone: '+15555555555', password: 'test-password123' } })).data;
    const original = billingApi.createSubscription;
    let signal, release;
    const started = new Promise(resolve => { signal = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const blocked = mock.method(billingApi, 'createSubscription', async options => { signal(); await gate; return original(options); });
    try {
      const first = call('/checkout/session', { token: account.token, method: 'POST', body: { plan: 'monthly' } });
      await started;
      const second = await call('/checkout/session', { token: account.token, method: 'POST', body: { plan: 'monthly' } });
      assert.equal(second.status, 409); assert.equal(blocked.mock.callCount(), 1);
      release(); assert.equal((await first).status, 200);
    } finally { release(); blocked.mock.restore(); }
  });
  await t.test('payment signatures and current server-side provider status are required to grant paid access', async () => {
    const user = await User.findById(owner.user.id);
    const id = user.subscriptionId;
    const body = { razorpay_payment_id: 'pay_test', razorpay_subscription_id: id };
    assert.equal((await call('/checkout/verify', { method: 'POST', body: { ...body, razorpay_signature: '0'.repeat(64) } })).status, 400);
    assert.equal((await call('/checkout/verify', { token: other.token, method: 'POST', body })).status, 400);
    await User.updateOne({ _id: owner.user.id }, { trialEndsAt: new Date(Date.now() - 1000) });
    const signature = sign(`pay_test|${id}`, process.env.RAZORPAY_KEY_SECRET);
    subscriptions.get(id).status = 'authenticated';
    const authorized = await call('/checkout/verify', { method: 'POST', body: { ...body, razorpay_signature: signature } });
    assert.equal(authorized.status, 200); assert.equal(authorized.data.user.hasReviewAccess, false);
    subscriptions.get(id).status = 'active'; subscriptions.get(id).current_end = Math.floor(Date.now() / 1000) + 86400;
    const verified = await call('/checkout/verify', { method: 'POST', body: { ...body, razorpay_signature: signature } });
    assert.equal(verified.status, 200); assert.equal(verified.data.user.hasReviewAccess, true); assert.equal(verified.data.user.plan, 'monthly');
  });
  await t.test('webhooks verify raw bytes and read current provider data instead of trusting event order', async () => {
    const user = await User.findById(owner.user.id); const id = user.subscriptionId;
    const event = { event: 'subscription.activated', payload: { subscription: { entity: { id, status: 'active', current_end: Math.floor(Date.now() / 1000) + 999999 } } } };
    const before = fetches;
    assert.equal((await call('/payments/razorpay/webhook', { token: null, method: 'POST', body: event, headers: { 'x-razorpay-signature': '0'.repeat(64) } })).status, 400);
    assert.equal(fetches, before);
    subscriptions.get(id).status = 'cancelled'; subscriptions.get(id).current_end = Math.floor(Date.now() / 1000) - 1;
    process.env.BILLING_ENABLED = 'false'; // Existing subscriptions still reconcile while new checkout is disabled.
    const signature = sign(JSON.stringify(event), process.env.RAZORPAY_WEBHOOK_SECRET);
    assert.equal((await call('/payments/razorpay/webhook', { token: null, method: 'POST', body: event, headers: { 'x-razorpay-signature': signature } })).status, 200);
    assert.equal(hasReviewAccess(await User.findById(owner.user.id)), false);
    assert.equal((await call('/payments/razorpay/webhook', { token: null, method: 'POST', body: event, headers: { 'x-razorpay-signature': signature } })).status, 200);
    assert.equal(hasReviewAccess(await User.findById(owner.user.id)), false);
  });
});
