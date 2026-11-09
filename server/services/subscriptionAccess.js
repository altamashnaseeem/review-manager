export const PAID_PLANS = ['monthly', 'quarterly', 'semi-annual'];
export function hasReviewAccess(user, now = Date.now()) {
  if (!user || !user.isActive) return false;
  if (user.plan === 'trial' && new Date(user.trialEndsAt).getTime() > now) return true;
  return PAID_PLANS.includes(user.plan)
    && ['active', 'cancelled', 'completed'].includes(user.subscriptionStatus)
    && new Date(user.subscriptionEndsAt).getTime() > now;
}
