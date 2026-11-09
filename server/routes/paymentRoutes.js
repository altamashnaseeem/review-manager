import express from 'express';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import BillingSubscription from '../models/BillingSubscription.js';
import { protect } from '../middleware/auth.js';
import { billingEnabled } from '../config/environment.js';
import { BILLING_CYCLES, billingApi, getBillingPlans, planIds, refreshSubscription, refreshAccountSubscriptions, ownedSubscription, rememberSubscription, validSignature } from '../services/billingService.js';
import { hasPaidAccess, paidEntitlement, preservePaidAccess } from '../services/subscriptionAccess.js';
import { publicUser } from '../utils/publicUser.js';
import { fail } from '../services/googleServices.js';

const router = express.Router();
const available = (_req, _res, next) => billingEnabled() ? next() : next(fail('Subscriptions are currently unavailable.', 503));
const checkoutResponse = (user, subscriptionId, plan, startsAt) => ({
  subscriptionId, plan, startsAt, razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  name: user.name, email: user.email, phone: user.phone,
});
router.get('/billing/plans', available, async (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json({ plans: await getBillingPlans() }); }
  catch (error) { next(error); }
});
router.post('/checkout/session', protect, available, async (req, res, next) => {
  let locked;
  const lockToken = randomUUID();
  try {
    const { plan, userId, expectedPlanId } = req.body;
    const plans = planIds();
    if (typeof plan !== 'string' || !Object.hasOwn(plans, plan) || !plans[plan]) throw fail('Choose a valid subscription plan.');
    if (userId && userId !== req.user.id) throw fail('Not authorized to change another account.', 403);
    if (expectedPlanId !== undefined && expectedPlanId !== plans[plan]) throw fail('This plan changed. Refresh the prices before checking out.', 409);
    const quote = (await getBillingPlans()).find(item => item.key === plan);
    locked = await User.findOneAndUpdate({ _id: req.user._id, $or: [{ billingLockUntil: { $exists: false } }, { billingLockUntil: { $lte: new Date() } }] }, {
      $set: { billingLockUntil: new Date(Date.now() + 120000), billingLockToken: lockToken }, $inc: { billingRevision: 1 },
    }, { new: true });
    if (!locked) throw fail('A checkout request is already processing. Please wait.', 409);
    if (locked.subscriptionId) {
      const previousId = locked.subscriptionId;
      await ownedSubscription(locked, previousId);
      let previous;
      try { previous = await billingApi.fetchSubscription(previousId); }
      catch { throw fail('Could not confirm your existing subscription. Try again later.', 502); }
      if (previous.id !== previousId || (previous.notes?.userId && previous.notes.userId !== String(locked._id))) throw fail('Subscription owner mismatch.', 403);
      if (previous.status === 'created' && previous.plan_id === plans[plan]) return res.json(checkoutResponse(locked, previous.id, quote, previous.start_at));
      if (previous.status === 'created') {
        // Replacement is limited to a confirmed unfinished checkout. If the
        // provider cannot confirm cancellation, do not create another one.
        try { await billingApi.cancelSubscription(previousId); }
        catch { /* A timed-out cancellation may have succeeded; confirm below. */ }
        try { previous = await billingApi.fetchSubscription(previousId); }
        catch { throw fail('Could not confirm cancellation of the unfinished checkout. Try again later.', 502); }
        if (!['cancelled', 'expired'].includes(previous.status)) throw fail('The unfinished checkout could not be replaced. Refresh its status before retrying.', 409);
      } else if (['authenticated', 'active', 'pending', 'halted', 'paused'].includes(previous.status)) {
        throw fail('Your existing subscription is already authorized. Refresh its status or manage it before choosing another plan.', 409);
      }
      locked = await refreshSubscription(locked, previousId);
    }
    const current = await User.findById(locked._id);
    const paidEnd = hasPaidAccess(current) ? new Date(paidEntitlement(current).endsAt).getTime() : 0;
    const trialEnd = current.plan === 'trial' ? current.trialEndsAt?.getTime() || 0 : 0;
    const starts = Math.max(paidEnd, trialEnd);
    const options = { plan_id: plans[plan], total_count: BILLING_CYCLES, quantity: 1, customer_notify: 1, notes: { userId: String(current._id), plan } };
    if (starts > Date.now() + 60000) options.start_at = Math.ceil(starts / 1000);
    let subscription;
    try { subscription = await billingApi.createSubscription(options); }
    catch { throw fail('Could not create a payment session. Try again later.', 502); }
    if (subscription.plan_id !== plans[plan]) throw fail('Payment provider returned a different plan. Refresh prices and retry.', 502);
    await rememberSubscription(current, subscription);
    let saved;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      const latest = await User.findById(current._id);
      saved = await User.findOneAndUpdate({ _id: latest._id, billingLockToken: lockToken, billingRevision: latest.billingRevision }, {
        $set: { ...preservePaidAccess(latest), subscriptionId: subscription.id, pendingPlan: plan,
          subscriptionStatus: subscription.status || 'created', subscriptionEndsAt: null },
        $inc: { billingRevision: 1 },
      }, { new: true });
    }
    if (!saved) throw fail('Checkout state changed. Refresh your subscription status before retrying.', 409);
    res.json(checkoutResponse(saved, subscription.id, quote, options.start_at));
  } catch (error) { next(error); }
  finally {
    if (locked) { try { await User.updateOne({ _id: locked._id, billingLockToken: lockToken }, { $unset: { billingLockUntil: 1, billingLockToken: 1 } }); } catch { /* Lease expires if MongoDB is unavailable. */ } }
  }
});
router.post('/checkout/verify', protect, async (req, res, next) => {
  try {
    const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = req.body;
    if (typeof paymentId !== 'string' || !paymentId) throw fail('Payment does not match this account.', 400);
    const owned = await ownedSubscription(req.user, subscriptionId);
    if (!validSignature(`${paymentId}|${owned.providerId}`, signature, process.env.RAZORPAY_KEY_SECRET)) throw fail('Payment signature verification failed.', 400);
    const user = await refreshSubscription(req.user, owned.providerId);
    res.json({ success: true, user: publicUser(user), message: user.subscriptionStatus === 'active' ? 'Subscription verified.' : 'Payment authorization verified. Your existing access is preserved; the new plan starts when its billing period begins.' });
  } catch (error) { next(error); }
});
router.post('/checkout/status', protect, async (req, res, next) => {
  try {
    if (!req.user.subscriptionId && !req.user.paidSubscriptionId) throw fail('No subscription is linked to this account.', 404);
    const user = await refreshAccountSubscriptions(req.user);
    res.json({ success: true, user: publicUser(user) });
  } catch (error) { next(error); }
});
export async function razorpayWebhook(req, res, next) {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) throw fail('Billing webhook is not configured.', 503);
    if (!Buffer.isBuffer(req.body) || !validSignature(req.body, req.headers['x-razorpay-signature'], process.env.RAZORPAY_WEBHOOK_SECRET)) throw fail('Invalid webhook signature.', 400);
    let event;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { throw fail('Invalid webhook payload.', 400); }
    const id = event.payload?.subscription?.entity?.id;
    if (typeof event.event !== 'string' || !event.event.startsWith('subscription.') || typeof id !== 'string') return res.json({ received: true });
    const record = await BillingSubscription.findOne({ providerId: id });
    const user = record ? await User.findById(record.owner) : await User.findOne({ $or: [{ subscriptionId: id }, { paidSubscriptionId: id }] });
    if (user) await refreshSubscription(user, id);
    res.json({ received: true });
  } catch (error) { next(error); }
}
export default router;
