import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { google } from 'googleapis';
import twilio from 'twilio';

Object.assign(process.env, {
  NODE_ENV: 'development', GOOGLE_BUSINESS_MOCK: 'true', JWT_SECRET: 'workflow-test-only',
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/business/google/callback',
  GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  TWILIO_ACCOUNT_SID: `AC${'0'.repeat(32)}`, TWILIO_AUTH_TOKEN: 'test-token-only',
  TWILIO_WHATSAPP_NUMBER: 'whatsapp:+15555555555', GROQ_API_KEY: 'test-ai-key-only',
});
const { default: app } = await import('../app.js');
const { default: Business } = await import('../models/Business.js');
const { default: Review } = await import('../models/Review.js');
const { processReviewAlerts, MAX_ALERT_ATTEMPTS, approvalLink } = await import('../services/reviewAlerts.js');
const { syncBusinessReviews } = await import('../services/reviewSync.js');
const { encryptToken } = await import('../services/googleServices.js');
const { normalizeWhatsAppNumber, buildWhatsAppAlert, sendWhatsAppAlert } = await import('../services/twilioService.js');
let mongo, server, base, owner, other;
async function call(path, { token = owner?.token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
const createBusiness = (values = {}) => Business.create({
  owner: owner.user.id, name: 'Workflow Cafe', googlePlaceId: `test-${randomBytes(8).toString('hex')}`,
  alertPhone: '+15555555556', alertOnRating: 3, googleConnected: true, reviewsSynced: true,
  googleAccountId: 'account', googleLocationId: 'location', googleRefreshToken: encryptToken('refresh'),
  ...values,
});
const createReview = (business, values = {}) => Review.create({ business: business._id,
  googleReviewId: `test-${randomBytes(8).toString('hex')}`, source: 'google', rating: 3,
  comment: 'The service was slow.', reviewDate: new Date(), alertEligible: true, alertStatus: 'pending', ...values,
});
before(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  await Business.init(); await Review.init();
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [key, email] of [['owner', 'owner@workflow.example'], ['other', 'other@workflow.example']]) {
    const response = await call('/auth/register', { token: null, method: 'POST', body: { name: key, email, password: 'password123', phone: '+15555555556' } });
    if (key === 'owner') owner = response.data; else other = response.data;
  }
});
after(async () => { mock.restoreAll(); if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); });

test('review alerts and approval workflow', async t => {
  await t.test('first import is silent; later qualifying reviews queue and only the owner approval posts to Google', async () => {
    const business = await createBusiness({ reviewsSynced: false });
    let phase = 0, googlePosts = 0;
    const raw = (id, rating) => ({ reviewId: id, starRating: rating, comment: 'Review text', createTime: '2026-01-01T00:00:00Z', updateTime: '2026-01-01T00:00:00Z' });
    const googleMock = mock.method(google.auth.OAuth2.prototype, 'request', async options => {
      if (options.method === 'PUT') { googlePosts++; assert.equal(options.data.comment, 'Owner approved edited draft'); return { data: {} }; }
      const reviews = [raw('historical-workflow', 'TWO'), ...(phase ? [raw('new-low-workflow', 'THREE'), raw('new-high-workflow', 'FOUR')] : [])];
      return { data: { reviews, averageRating: 3, totalReviewCount: reviews.length } };
    });
    await syncBusinessReviews(business, { notify: true });
    assert.equal((await Review.findOne({ googleReviewId: 'historical-workflow' })).alertEligible, false);
    phase = 1;
    await syncBusinessReviews(business, { notify: false });
    const low = await Review.findOne({ googleReviewId: 'new-low-workflow' });
    assert.equal(low.alertEligible, true);
    assert.equal((await Review.findOne({ googleReviewId: 'new-high-workflow' })).alertEligible, false);
    let alerts = 0;
    await processReviewAlerts(business, { generateReply: async () => 'AI proposed draft', sendAlert: async details => {
      alerts++; assert.equal(details.to, business.alertPhone);
      assert.equal(new URL(details.replyLink).searchParams.get('review'), String(low._id));
      assert.equal(new URL(details.replyLink).searchParams.get('business'), String(business._id));
      return { sid: 'SMaccepted', status: 'queued' };
    } });
    const notified = await Review.findById(low._id);
    assert.equal(alerts, 1); assert.equal(notified.alertStatus, 'accepted');
    assert.equal(notified.aiSuggestedReply, 'AI proposed draft');
    assert.equal(notified.replyStatus, 'pending'); assert.equal(googlePosts, 0);
    const denied = await call(`/reviews/${low._id}/post-reply`, { token: other.token, method: 'POST', body: { finalReply: 'wrong owner' } });
    assert.equal(denied.status, 403); assert.equal(googlePosts, 0);
    const posted = await call(`/reviews/${low._id}/post-reply`, { method: 'POST', body: { finalReply: '  Owner approved edited draft  ' } });
    assert.equal(posted.status, 200); assert.equal(googlePosts, 1);
    assert.equal(posted.data.review.approvedBy, owner.user.id);
    assert.ok(posted.data.review.approvedAt); assert.equal(posted.data.review.finalReply, 'Owner approved edited draft');
    const again = await call(`/reviews/${low._id}/post-reply`, { method: 'POST', body: { finalReply: 'Owner approved edited draft' } });
    assert.equal(again.status, 200); assert.equal(googlePosts, 1);
    const target = await call(`/reviews/${business._id}?reviewId=${low._id}`);
    assert.equal(target.data.total, 1); assert.equal(target.data.reviews[0]._id, String(low._id));
    await processReviewAlerts(business, { sendAlert: async () => { throw new Error('Do not resend'); } });
    assert.equal((await Review.findById(low._id)).alertAttemptCount, 1);
    googleMock.mock.restore();
  });
  await t.test('all 25 owner-threshold/customer-rating combinations use the saved business setting', async () => {
    const expected = { 1: [1], 2: [1, 2], 3: [1, 2, 3], 4: [1, 2, 3, 4], 5: [1, 2, 3, 4, 5] };
    for (const threshold of [1, 2, 3, 4, 5]) {
      const original = await createBusiness({ alertOnRating: 3 });
      const update = await call(`/business/${original._id}`, { method: 'PUT', body: { alertOnRating: threshold } });
      assert.equal(update.status, 200);
      assert.equal(update.data.business.alertOnRating, threshold);
      const business = await Business.findById(original._id);
      const googleMock = mock.method(google.auth.OAuth2.prototype, 'request', async () => ({ data: {
        reviews: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].map((starRating, index) => ({
          reviewId: `matrix-${business._id}-${index + 1}`, starRating, comment: 'Threshold matrix review',
          createTime: '2026-01-01T00:00:00Z', updateTime: '2026-01-01T00:00:00Z',
        })), averageRating: 3, totalReviewCount: 5,
      } }));
      await syncBusinessReviews(business, { notify: false });
      googleMock.mock.restore();
      const eligible = await Review.find({ business: business._id, alertEligible: true }).sort({ rating: 1 });
      assert.deepEqual(eligible.map(review => review.rating), expected[threshold]);
      const notified = [];
      await processReviewAlerts(business, {
        generateReply: async () => 'Draft awaiting owner approval',
        sendAlert: async details => { notified.push(details.rating); return { sid: `SMmatrix${threshold}${details.rating}`, status: 'queued' }; },
      });
      assert.deepEqual(notified.sort(), expected[threshold]);
      const pending = await call(`/reviews/${business._id}?status=pending`);
      assert.equal(pending.status, 200);
      assert.deepEqual(pending.data.reviews.map(review => review.rating).sort(), expected[threshold]);
      assert.equal((await call(`/reviews/${business._id}/stats`)).data.stats.pendingReplies, threshold);
    }
    const invalid = await call('/business', { method: 'POST', body: { name: 'Invalid threshold', alertPhone: '+15555555556', alertOnRating: 0 } });
    assert.equal(invalid.status, 400);
  });
  await t.test('failed alerts retry without requiring another review and preserve the AI draft', async () => {
    const business = await createBusiness(); const review = await createReview(business);
    let drafts = 0, sends = 0;
    const dependencies = { generateReply: async () => { drafts++; return 'Persistent AI draft'; }, sendAlert: async () => { sends++; throw new Error('Provider unavailable'); } };
    await processReviewAlerts(business, dependencies);
    let stored = await Review.findById(review._id);
    assert.equal(stored.alertStatus, 'failed'); assert.equal(stored.alertAttemptCount, 1);
    assert.equal(stored.aiSuggestedReply, 'Persistent AI draft'); assert.equal(stored.alertSent, false);
    await processReviewAlerts(business, dependencies); assert.equal(sends, 1);
    await Review.updateOne({ _id: review._id }, { alertNextAttemptAt: new Date(0) });
    await processReviewAlerts(business, { ...dependencies, sendAlert: async () => { sends++; return { sid: 'SMretry', status: 'queued' }; } });
    stored = await Review.findById(review._id);
    assert.equal(stored.alertStatus, 'accepted'); assert.equal(stored.alertAttemptCount, 2);
    assert.equal(drafts, 1); assert.equal(sends, 2);
  });
  await t.test('concurrent alert workers submit one notification', async () => {
    const business = await createBusiness(); await createReview(business);
    let sends = 0;
    const dependencies = { generateReply: async () => 'Draft', sendAlert: async () => { sends++; return { sid: 'SMonce', status: 'queued' }; } };
    await Promise.all([processReviewAlerts(business, dependencies), processReviewAlerts(business, dependencies)]);
    assert.equal(sends, 1);
  });
  await t.test('AI failure does not prevent an alert with a manual reply link', async () => {
    const business = await createBusiness(); const review = await createReview(business);
    await processReviewAlerts(business, { generateReply: async () => { throw new Error('AI offline'); }, sendAlert: async details => {
      assert.ok(details.replyLink); assert.equal(details.aiSuggestedReply, null); return { sid: 'SMnoai', status: 'queued' };
    } });
    const stored = await Review.findById(review._id);
    assert.equal(stored.alertStatus, 'accepted'); assert.match(stored.aiReplyError, /unavailable/);
  });
  await t.test('retries stop after five attempts and do not alert for dismissed or above-threshold reviews', async () => {
    const business = await createBusiness({ alertOnRating: 2 });
    const low = await createReview(business, { rating: 2 });
    const high = await createReview(business, { rating: 3 });
    const dismissed = await createReview(business, { rating: 1, replyStatus: 'dismissed' });
    let sends = 0;
    for (let i = 0; i <= MAX_ALERT_ATTEMPTS; i++) {
      await Review.updateOne({ _id: low._id }, { alertNextAttemptAt: new Date(0) });
      await processReviewAlerts(business, { generateReply: async () => 'Draft', sendAlert: async () => { sends++; throw new Error('Provider offline'); } });
    }
    assert.equal(sends, MAX_ALERT_ATTEMPTS);
    assert.equal((await Review.findById(high._id)).alertAttemptCount, 0);
    assert.equal((await Review.findById(dismissed._id)).alertAttemptCount, 0);
  });
  await t.test('Google posting failure preserves approved text for retry; concurrent approvals cannot duplicate posting', async () => {
    const business = await createBusiness(); const review = await createReview(business);
    let fail = true, posts = 0, release, signal;
    const started = new Promise(resolve => { signal = resolve; });
    const googleMock = mock.method(google.auth.OAuth2.prototype, 'request', async options => {
      assert.equal(options.method, 'PUT'); posts++;
      if (fail) throw { response: { status: 500 } };
      signal(); await new Promise(resolve => { release = resolve; });
      return { data: {} };
    });
    const body = { finalReply: 'Approved retry text' };
    const failed = await call(`/reviews/${review._id}/post-reply`, { method: 'POST', body });
    assert.equal(failed.status, 502);
    assert.equal((await Review.findById(review._id)).replyStatus, 'approved');
    assert.equal((await Review.findById(review._id)).finalReply, body.finalReply);
    fail = false;
    const first = call(`/reviews/${review._id}/post-reply`, { method: 'POST', body });
    await started;
    const second = await call(`/reviews/${review._id}/post-reply`, { method: 'POST', body });
    assert.equal(second.status, 409); release();
    assert.equal((await first).status, 200); assert.equal(posts, 2);
    googleMock.mock.restore();
  });
  await t.test('demo events honor threshold 4, remain after resync, and require no external AI or WhatsApp', async () => {
    const business = await createBusiness({ isDemo: true, alertOnRating: 4 });
    const low = await call(`/reviews/${business._id}/demo-review`, { method: 'POST', body: { rating: 4, comment: 'New four-star test' } });
    assert.equal(low.status, 201); assert.equal(low.data.review.alertStatus, 'simulated');
    assert.equal(low.data.review.alertSent, false); assert.match(low.data.review.aiSuggestedReply, /Demo reply/);
    const high = await call(`/reviews/${business._id}/demo-review`, { method: 'POST', body: { rating: 5 } });
    assert.equal(high.status, 201); assert.equal(high.data.review.alertStatus, 'skipped');
    await syncBusinessReviews(await Business.findById(business._id));
    assert.equal((await Business.findById(business._id)).totalReviews, 127);
    assert.equal((await Review.findById(low.data.review._id)).alertStatus, 'simulated');
    assert.equal((await call(`/reviews/${business._id}/demo-review`, { token: other.token, method: 'POST', body: { rating: 1 } })).status, 404);
    await Review.updateOne({ _id: low.data.review._id }, { alertStatus: 'failed', alertAttemptCount: 5 });
    assert.equal((await call(`/reviews/${low.data.review._id}/retry-alert`, { token: other.token, method: 'POST', body: {} })).status, 403);
    const retried = await call(`/reviews/${low.data.review._id}/retry-alert`, { method: 'POST', body: {} });
    assert.equal(retried.status, 200); assert.equal(retried.data.review.alertStatus, 'simulated');
    assert.equal(retried.data.review.alertAttemptCount, 1);
    const posted = await call(`/reviews/${low.data.review._id}/post-reply`, { method: 'POST', body: { finalReply: 'Demo owner approval' } });
    assert.equal(posted.status, 200); assert.match(posted.data.message, /nothing was posted/);
    process.env.NODE_ENV = 'production';
    assert.equal((await call(`/reviews/${business._id}/demo-review`, { method: 'POST', body: { rating: 1 } })).status, 404);
    process.env.NODE_ENV = 'development';
  });
  await t.test('Twilio uses explicit international numbers and approved templates for production', async () => {
    assert.equal(normalizeWhatsAppNumber('+91 98765-43210'), 'whatsapp:+919876543210');
    assert.throws(() => normalizeWhatsAppNumber('9876543210'), /country code/);
    const details = { to: '+15555555556', businessName: 'Cafe', reviewerName: 'Customer', rating: 2, comment: 'Slow service', replyLink: approvalLink('business', 'review'), aiSuggestedReply: 'AI draft' };
    const sandbox = buildWhatsAppAlert(details);
    assert.match(sandbox.body, /AI draft/); assert.match(sandbox.body, /before you approve/);
    process.env.NODE_ENV = 'production';
    assert.throws(() => buildWhatsAppAlert(details), /approved/);
    process.env.TWILIO_REVIEW_ALERT_CONTENT_SID = `HX${'0'.repeat(32)}`;
    const template = buildWhatsAppAlert(details);
    assert.equal('body' in template, false); assert.equal(JSON.parse(template.contentVariables)['5'], details.replyLink);
    const transport = mock.method(twilio.Twilio.prototype, 'request', async options => {
      assert.equal(options.data.ContentSid, process.env.TWILIO_REVIEW_ALERT_CONTENT_SID);
      assert.equal(options.data.To, 'whatsapp:+15555555556');
      return { statusCode: 201, body: { sid: 'SMtransport', status: 'queued' }, headers: {} };
    });
    const result = await sendWhatsAppAlert(details);
    assert.equal(result.sid, 'SMtransport');
    transport.mock.restore(); delete process.env.TWILIO_REVIEW_ALERT_CONTENT_SID; process.env.NODE_ENV = 'development';
  });
});
