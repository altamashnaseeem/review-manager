import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import BillingSubscription from '../models/BillingSubscription.js';
import { billingEnabled } from '../config/environment.js';
import { hasPaidAccess, paidEntitlement, preservePaidAccess } from './subscriptionAccess.js';
import { fail } from './googleServices.js';

export const BILLING_CYCLES = 12;
export const planIds = () => ({ monthly: process.env.RAZORPAY_PLAN_MONTHLY_ID, quarterly: process.env.RAZORPAY_PLAN_QUARTERLY_ID, 'semi-annual': process.env.RAZORPAY_PLAN_SEMI_ANNUAL_ID });
const months = { monthly: 1, quarterly: 3, 'semi-annual': 6 };
const client = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw fail('Subscriptions are currently unavailable.', 503);
  const instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  instance.api.rq.defaults.timeout = 15000;
  return instance;
};
export const billingApi = {
  createSubscription: options => client().subscriptions.create(options),
  fetchSubscription: id => client().subscriptions.fetch(id),
  cancelSubscription: id => client().subscriptions.cancel(id, false),
  fetchPlan: id => client().plans.fetch(id),
};
let catalog;
export async function getBillingPlans({ fresh = false } = {}) {
  if (!billingEnabled()) throw fail('Subscriptions are currently unavailable.', 503);
  const ids = planIds();
  if (Object.values(ids).some(id => !id) || new Set(Object.values(ids)).size !== 3) throw fail('Subscription plans are not configured.', 503);
  const key = JSON.stringify([process.env.RAZORPAY_KEY_ID, ids]);
  if (!fresh && catalog?.key === key && catalog.expires > Date.now()) return catalog.plans;
  let plans;
  try {
    plans = await Promise.all(Object.entries(ids).map(async ([name, id]) => {
      const plan = await billingApi.fetchPlan(id);
      if (plan.id !== id || plan.period !== 'monthly' || plan.interval !== months[name]
        || plan.item?.currency !== 'INR' || !Number.isSafeInteger(plan.item?.amount) || plan.item.amount <= 0) throw new Error('Invalid plan');
      return { key: name, planId: id, months: months[name], amount: plan.item.amount, currency: plan.item.currency,
        taxInclusive: plan.item.tax_inclusive === true, totalCycles: BILLING_CYCLES };
    }));
  } catch { throw fail('Subscription prices are currently unavailable. Please try again later.', 503); }
  catalog = { key, plans, expires: Date.now() + 30000 };
  return plans;
}
export function validSignature(payload, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(payload).digest(), Buffer.from(signature, 'hex'));
}
export async function ownedSubscription(user, id) {
  if (typeof id !== 'string' || !id) throw fail('Payment does not match this account.', 400);
  const existing = await BillingSubscription.findOne({ providerId: id });
  if (existing) {
    if (String(existing.owner) !== String(user._id)) throw fail('Payment does not match this account.', 400);
    return existing;
  }
  if (id !== user.subscriptionId && id !== user.paidSubscriptionId) throw fail('Payment does not match this account.', 400);
  try {
    return await BillingSubscription.findOneAndUpdate({ providerId: id, owner: user._id }, {
      $setOnInsert: { owner: user._id },
    }, { upsert: true, new: true });
  } catch { throw fail('Payment does not match this account.', 400); }
}
export async function rememberSubscription(user, subscription) {
  if (typeof subscription?.id !== 'string' || !subscription.id) throw fail('Payment provider returned an invalid subscription.', 502);
  if (subscription.notes?.userId && subscription.notes.userId !== String(user._id)) throw fail('Subscription owner mismatch.', 403);
  try {
    return await BillingSubscription.findOneAndUpdate({ providerId: subscription.id, owner: user._id }, {
      $setOnInsert: { owner: user._id },
    }, { upsert: true, new: true });
  } catch { throw fail('Subscription owner mismatch.', 403); }
}
export async function refreshSubscription(user, id = user.subscriptionId) {
  await ownedSubscription(user, id);
  // A newer reconciliation or checkout invalidates an older in-flight response.
  const current = await User.findByIdAndUpdate(user._id, { $inc: { billingRevision: 1 } }, { new: true });
  if (!current) throw fail('Account not found.', 404);
  let subscription;
  try { subscription = await billingApi.fetchSubscription(id); }
  catch { throw fail('Could not confirm subscription status with the payment provider. Try again later.', 502); }
  if (subscription.id !== id) throw fail('Subscription mismatch.', 409);
  const plan = Object.entries(planIds()).find(([, planId]) => planId && planId === subscription.plan_id)?.[0];
  if (!plan) throw fail('The payment provider returned an unrecognized plan. Contact the app administrator.', 409);
  if (subscription.notes?.userId && subscription.notes.userId !== String(user._id)) throw fail('Subscription owner mismatch.', 403);
  const end = Number.isFinite(subscription.current_end) && subscription.current_end > 0 ? new Date(subscription.current_end * 1000) : null;
  const paid = paidEntitlement(current);
  const update = preservePaidAccess(current);
  if (id === current.subscriptionId) {
    update.subscriptionStatus = subscription.status;
    update.subscriptionEndsAt = end;
  }
  const granting = ['active', 'cancelled', 'completed'].includes(subscription.status)
    && subscription.paid_count > 0 && end?.getTime() > Date.now();
  if ((id === paid.id && (current.paidSubscriptionId || hasPaidAccess(current))) || (granting && (id === current.subscriptionId || !hasPaidAccess(current)))) {
    Object.assign(update, { paidSubscriptionId: id, paidPlan: plan, paidStatus: subscription.status,
      paidThrough: subscription.paid_count > 0 ? end : null });
    if (granting) update.plan = plan;
  }
  const saved = await User.findOneAndUpdate({ _id: current._id, billingRevision: current.billingRevision }, {
    $set: update,
  }, { new: true });
  if (!saved) throw fail('Subscription status changed while checking. Please refresh its status.', 409);
  await BillingSubscription.updateOne({ providerId: id, owner: user._id }, {
    $set: { plan, status: subscription.status, paidCount: subscription.paid_count || 0, periodEndsAt: end },
  });
  return saved;
}
export async function refreshAccountSubscriptions(user) {
  let current = user;
  for (const id of [...new Set([user.paidSubscriptionId, user.subscriptionId].filter(Boolean))]) current = await refreshSubscription(current, id);
  return current;
}
