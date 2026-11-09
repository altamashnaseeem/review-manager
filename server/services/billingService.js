import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fail } from './googleServices.js';

export const planIds = () => ({ monthly: process.env.RAZORPAY_PLAN_MONTHLY_ID, quarterly: process.env.RAZORPAY_PLAN_QUARTERLY_ID, 'semi-annual': process.env.RAZORPAY_PLAN_SEMI_ANNUAL_ID });
const client = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw fail('Subscriptions are currently unavailable.', 503);
  const instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  // Bound the SDK transport so a stalled provider cannot hold checkout indefinitely.
  instance.api.rq.defaults.timeout = 15000;
  return instance;
};
export const billingApi = {
  createSubscription: options => client().subscriptions.create(options),
  fetchSubscription: id => client().subscriptions.fetch(id),
};
export function validSignature(payload, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export async function refreshSubscription(user) {
  let subscription;
  try { subscription = await billingApi.fetchSubscription(user.subscriptionId); }
  catch { throw fail('Could not confirm subscription status with the payment provider. Try again later.', 502); }
  if (subscription.id !== user.subscriptionId) throw fail('Subscription mismatch.', 409);
  const plan = Object.entries(planIds()).find(([, id]) => id && id === subscription.plan_id)?.[0];
  if (!plan) throw fail('The payment provider returned an unrecognized plan. Contact the app administrator.', 409);
  if (subscription.notes?.userId && subscription.notes.userId !== String(user._id)) throw fail('Subscription owner mismatch.', 403);
  user.subscriptionStatus = subscription.status;
  if (Number.isFinite(subscription.current_end) && subscription.current_end > 0) user.subscriptionEndsAt = new Date(subscription.current_end * 1000);
  if (['active', 'cancelled', 'completed'].includes(subscription.status) && user.subscriptionEndsAt?.getTime() > Date.now()) user.plan = plan;
  // A client-side success or an authenticated future subscription does not grant paid access.
  await user.save();
  return user;
}
