import express from 'express';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { billingEnabled } from '../config/environment.js';
import { billingApi, planIds, refreshSubscription, validSignature } from '../services/billingService.js';
import { publicUser } from '../utils/publicUser.js';
import { fail } from '../services/googleServices.js';

const router = express.Router();
const available = (_req, _res, next) => billingEnabled() ? next() : next(fail('Subscriptions are currently unavailable.', 503));
const checkoutResponse = (user, subscriptionId) => ({
  subscriptionId, razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  name: user.name, email: user.email, phone: user.phone,
});
router.post('/checkout/session', protect, available, async (req, res, next) => {
  let locked;
  const lockToken = randomUUID();
  try {
    const { plan, userId } = req.body;
    const plans = planIds();
    if (typeof plan !== 'string' || !Object.hasOwn(plans, plan) || !plans[plan]) throw fail('Choose a valid subscription plan.');
    if (userId && userId !== req.user.id) throw fail('Not authorized to change another account.', 403);
    locked = await User.findOneAndUpdate({ _id: req.user._id, $or: [{ billingLockUntil: { $exists: false } }, { billingLockUntil: { $lte: new Date() } }] }, {
      $set: { billingLockUntil: new Date(Date.now() + 120000), billingLockToken: lockToken },
    }, { new: true });
    if (!locked) throw fail('A checkout request is already processing. Please wait.', 409);
    if (locked.subscriptionId) {
      let previous;
      try { previous = await billingApi.fetchSubscription(locked.subscriptionId); }
      catch { throw fail('Could not confirm your existing subscription. Try again later.', 502); }
      if (['created', 'authenticated', 'active', 'pending', 'halted', 'paused'].includes(previous.status)) {
        if (previous.plan_id !== plans[plan]) throw fail('Manage or cancel your existing subscription before choosing another plan.', 409);
        if (previous.status !== 'created') throw fail('Your existing subscription is already authorized. Refresh its status instead of paying again.', 409);
        return res.json(checkoutResponse(locked, previous.id));
      }
    }
    const options = { plan_id: plans[plan], total_count: 12, quantity: 1, customer_notify: 1, notes: { userId: String(locked._id), plan } };
    if (locked.plan === 'trial' && locked.trialEndsAt?.getTime() > Date.now() + 60000) options.start_at = Math.ceil(locked.trialEndsAt.getTime() / 1000);
    let subscription;
    try { subscription = await billingApi.createSubscription(options); }
    catch { throw fail('Could not create a payment session. Try again later.', 502); }
    const saved = await User.findOneAndUpdate({ _id: locked._id, billingLockToken: lockToken }, {
      $set: { subscriptionId: subscription.id, pendingPlan: plan, subscriptionStatus: subscription.status || 'created' },
    }, { new: true });
    if (!saved) throw fail('Checkout state changed. Refresh your subscription status before retrying.', 409);
    res.json(checkoutResponse(saved, subscription.id));
  } catch (error) { next(error); }
  finally { if (locked) { try { await User.updateOne({ _id: locked._id, billingLockToken: lockToken }, { $unset: { billingLockUntil: 1, billingLockToken: 1 } }); } catch { /* The lease expires if the database is temporarily unavailable. */ } } }
});
router.post('/checkout/verify', protect, async (req, res, next) => {
  try {
    const user = req.user;
    const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = req.body;
    if (typeof paymentId !== 'string' || !user.subscriptionId || subscriptionId !== user.subscriptionId) throw fail('Payment does not match this account.', 400);
    // Use the server-stored subscription ID, never trust a client-chosen ID for HMAC input.
    if (!validSignature(`${paymentId}|${user.subscriptionId}`, signature, process.env.RAZORPAY_KEY_SECRET)) throw fail('Payment signature verification failed.', 400);
    await refreshSubscription(user);
    res.json({ success: true, user: publicUser(user), message: user.subscriptionStatus === 'active' ? 'Subscription verified.' : 'Payment authorization verified. Access updates when the subscription becomes active.' });
  } catch (error) { next(error); }
});
router.post('/checkout/status', protect, async (req, res, next) => {
  try {
    if (!req.user.subscriptionId) throw fail('No subscription is linked to this account.', 404);
    await refreshSubscription(req.user);
    res.json({ success: true, user: publicUser(req.user) });
  } catch (error) { next(error); }
});

export async function razorpayWebhook(req, res, next) {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) throw fail('Billing webhook is not configured.', 503);
    if (!Buffer.isBuffer(req.body) || !validSignature(req.body, req.headers['x-razorpay-signature'], process.env.RAZORPAY_WEBHOOK_SECRET)) throw fail('Invalid webhook signature.', 400);
    let event;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { throw fail('Invalid webhook payload.', 400); }
    if (typeof event.event !== 'string' || !event.event.startsWith('subscription.') || !event.payload?.subscription?.entity?.id) return res.json({ received: true });
    const user = await User.findOne({ subscriptionId: event.payload.subscription.entity.id });
    // Fetch the current provider snapshot. Replays/out-of-order events cannot apply stale payloads.
    if (user) await refreshSubscription(user);
    res.json({ received: true });
  } catch (error) { next(error); }
}
export default router;
