import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'regression-tests-only', BILLING_ENABLED: 'true',
  RAZORPAY_KEY_ID: 'rzp_test_regression', RAZORPAY_KEY_SECRET: 'regression-secret', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  RAZORPAY_PLAN_MONTHLY_ID: 'plan_month', RAZORPAY_PLAN_QUARTERLY_ID: 'plan_quarter', RAZORPAY_PLAN_SEMI_ANNUAL_ID: 'plan_half',
});
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');
const { default: BillingSubscription } = await import('../models/BillingSubscription.js');
const { billingApi, getBillingPlans, refreshSubscription } = await import('../services/billingService.js');
const { hasReviewAccess } = await import('../services/subscriptionAccess.js');
let mongo, server, base, creates = 0, cancels = 0;
const subs = new Map(), options = [];
const prices = { plan_month: 123400, plan_quarter: 345600, plan_half: 654300 };
const months = { plan_month: 1, plan_quarter: 3, plan_half: 6 };
const sign = value => createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(value).digest('hex');
async function call(path, { account, body, method = 'GET', headers: extra } = {}) {
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(account ? { Authorization: `Bearer ${account.token}` } : {}), ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function account(name) {
  return (await call('/auth/register', { method: 'POST', body: { name, email: `${name}@billing.example`, password: 'test-password123', phone: '+15555555555' } })).data;
}
async function paidAccount(name) {
  const result = await account(name), id = `sub_old_${name}`, end = Math.floor(Date.now() / 1000) + 7 * 86400;
  subs.set(id, { id, status: 'cancelled', plan_id: 'plan_month', paid_count: 1, current_end: end, notes: { userId: result.user.id } });
  await User.updateOne({ _id: result.user.id }, { plan: 'monthly', trialEndsAt: new Date(0), subscriptionId: id, subscriptionStatus: 'cancelled', subscriptionEndsAt: new Date(end * 1000) });
  return { ...result, oldId: id, paidEnd: end };
}
before(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); await BillingSubscription.init();
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  mock.method(billingApi, 'fetchPlan', async id => ({ id, period: 'monthly', interval: months[id], item: { amount: prices[id], currency: 'INR', tax_inclusive: true } }));
  mock.method(billingApi, 'fetchSubscription', async id => { if (!subs.has(id)) throw new Error('Unknown fake subscription'); return { ...subs.get(id) }; });
  mock.method(billingApi, 'createSubscription', async value => {
    creates++; options.push(value);
    const sub = { id: `sub_new_${creates}`, status: 'created', plan_id: value.plan_id, notes: value.notes, paid_count: 0, current_end: null, start_at: value.start_at };
    subs.set(sub.id, sub); return sub;
  });
  mock.method(billingApi, 'cancelSubscription', async id => { cancels++; subs.get(id).status = 'cancelled'; return { ...subs.get(id) }; });
});
after(async () => { mock.restoreAll(); await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });

test('billing regressions', async t => {
  await t.test('public prices and checkout quote come from the same provider plan and wrong cadence fails closed', async () => {
    const catalog = await call('/billing/plans'); assert.equal(catalog.status, 200);
    assert.deepEqual(catalog.data.plans.map(plan => plan.amount), [123400, 345600, 654300]);
    const owner = await account('prices');
    const response = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'quarterly', expectedPlanId: 'plan_quarter' } });
    assert.equal(response.status, 200); assert.deepEqual(response.data.plan, catalog.data.plans[1]);
    assert.equal((await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'quarterly', expectedPlanId: 'old-plan-id' } })).status, 409);
    const bad = mock.method(billingApi, 'fetchPlan', async id => ({ id, period: 'monthly', interval: 1, item: { amount: 10000, currency: 'INR' } }));
    try { await assert.rejects(getBillingPlans({ fresh: true }), /prices are currently unavailable/); }
    finally { bad.mock.restore(); }
    await getBillingPlans({ fresh: true });
  });
  await t.test('starting and authorizing a new plan preserves already-paid access and schedules after paid-through', async () => {
    const owner = await paidAccount('preserve');
    assert.equal(hasReviewAccess(await User.findById(owner.user.id)), true);
    const response = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'quarterly' } });
    assert.equal(response.status, 200); assert.equal(response.data.startsAt, owner.paidEnd);
    let user = await User.findById(owner.user.id);
    assert.equal(user.subscriptionStatus, 'created'); assert.equal(user.paidSubscriptionId, owner.oldId);
    assert.equal(user.paidThrough.getTime(), owner.paidEnd * 1000); assert.equal(hasReviewAccess(user), true);
    const id = response.data.subscriptionId; subs.get(id).status = 'authenticated';
    const verified = await call('/checkout/verify', { account: owner, method: 'POST', body: { razorpay_payment_id: 'pay_auth', razorpay_subscription_id: id, razorpay_signature: sign(`pay_auth|${id}`) } });
    assert.equal(verified.status, 200); assert.equal(verified.data.user.hasReviewAccess, true); assert.equal(verified.data.user.plan, 'monthly');
    user = await User.findById(owner.user.id); assert.equal(user.paidThrough.getTime(), owner.paidEnd * 1000);
  });
  await t.test('abandoned checkout is reused for the same plan and confirmed cancelled before a different plan replaces it', async () => {
    const owner = await account('replace');
    const first = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'monthly' } });
    const before = creates;
    const same = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'monthly' } });
    assert.equal(same.data.subscriptionId, first.data.subscriptionId); assert.equal(creates, before);
    const second = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'semi-annual' } });
    assert.equal(second.status, 200); assert.notEqual(second.data.subscriptionId, first.data.subscriptionId);
    assert.equal(subs.get(first.data.subscriptionId).status, 'cancelled'); assert.equal(creates, before + 1);
    assert.equal(await BillingSubscription.countDocuments({ owner: owner.user.id }), 2);
    assert.ok(cancels > 0);
  });
  await t.test('failed or unconfirmed cancellation never creates a second checkout', async () => {
    const owner = await account('cancelerror');
    await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'monthly' } });
    const before = creates;
    const bad = mock.method(billingApi, 'cancelSubscription', async () => { throw new Error('Provider unavailable'); });
    try {
      assert.equal((await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'quarterly' } })).status, 409);
      assert.equal(creates, before);
    } finally { bad.mock.restore(); }
  });
  await t.test('new paid activation supersedes old access and delayed old webhooks cannot revoke it', async () => {
    const owner = await paidAccount('promote');
    const created = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'quarterly' } });
    const id = created.data.subscriptionId, end = owner.paidEnd + 90 * 86400;
    Object.assign(subs.get(id), { status: 'active', paid_count: 1, current_end: end });
    const verified = await call('/checkout/verify', { account: owner, method: 'POST', body: { razorpay_payment_id: 'pay_new', razorpay_subscription_id: id, razorpay_signature: sign(`pay_new|${id}`) } });
    assert.equal(verified.status, 200); assert.equal(verified.data.user.plan, 'quarterly');
    subs.get(owner.oldId).current_end = 1;
    const event = { event: 'subscription.cancelled', payload: { subscription: { entity: { id: owner.oldId } } } };
    const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(JSON.stringify(event)).digest('hex');
    assert.equal((await call('/payments/razorpay/webhook', { method: 'POST', body: event, headers: { 'x-razorpay-signature': signature } })).status, 200);
    const user = await User.findById(owner.user.id);
    assert.equal(user.paidSubscriptionId, id); assert.equal(user.paidThrough.getTime(), end * 1000); assert.equal(hasReviewAccess(user), true);
  });
  await t.test('late callbacks remain owner-bound after replacement, and unpaid activation never grants access', async () => {
    const owner = await account('late'), stranger = await account('stranger');
    await User.updateOne({ _id: owner.user.id }, { trialEndsAt: new Date(0) });
    const first = await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'monthly' } });
    await call('/checkout/session', { account: owner, method: 'POST', body: { plan: 'quarterly' } });
    const id = first.data.subscriptionId;
    Object.assign(subs.get(id), { status: 'active', paid_count: 0, current_end: Math.floor(Date.now() / 1000) + 86400 });
    const body = { razorpay_payment_id: 'pay_late', razorpay_subscription_id: id, razorpay_signature: sign(`pay_late|${id}`) };
    assert.equal((await call('/checkout/verify', { account: stranger, method: 'POST', body })).status, 400);
    assert.equal((await call('/checkout/verify', { account: owner, method: 'POST', body })).data.user.hasReviewAccess, false);
    subs.get(id).paid_count = 1;
    assert.equal((await call('/checkout/verify', { account: owner, method: 'POST', body })).data.user.hasReviewAccess, true);
  });
  await t.test('an older in-flight provider response cannot overwrite a newer verified state', async () => {
    const owner = await paidAccount('race'); let signal, release;
    const started = new Promise(resolve => { signal = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let calls = 0;
    const transport = mock.method(billingApi, 'fetchSubscription', async id => {
      calls++;
      if (calls === 1) { const old = { ...subs.get(id) }; signal(); await gate; return old; }
      return { ...subs.get(id), status: 'halted', current_end: 1 };
    });
    try {
      const older = refreshSubscription(await User.findById(owner.user.id));
      const rejected = assert.rejects(older, /status changed/);
      await started;
      await refreshSubscription(await User.findById(owner.user.id));
      release(); await rejected;
      assert.equal(hasReviewAccess(await User.findById(owner.user.id)), false);
    } finally { release(); transport.mock.restore(); }
  });
});
