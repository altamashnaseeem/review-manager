import { hasReviewAccess } from '../services/subscriptionAccess.js';
import { billingEnabled } from '../config/environment.js';
export const publicUser = user => ({
  id: user._id, name: user.name, email: user.email, phone: user.phone,
  plan: user.plan, trialEndsAt: user.trialEndsAt, subscriptionStatus: user.subscriptionStatus,
  subscriptionEndsAt: user.subscriptionEndsAt, paidThrough: user.paidThrough, hasSubscription: Boolean(user.subscriptionId || user.paidSubscriptionId), hasReviewAccess: hasReviewAccess(user), billingEnabled: billingEnabled(),
});
