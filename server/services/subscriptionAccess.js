export const PAID_PLANS = ['monthly', 'quarterly', 'semi-annual'];
export function paidEntitlement(user) {
  return user?.paidSubscriptionId ? {
    id: user.paidSubscriptionId, plan: user.paidPlan, status: user.paidStatus, endsAt: user.paidThrough,
  } : {
    id: user?.subscriptionId, plan: user?.plan, status: user?.subscriptionStatus, endsAt: user?.subscriptionEndsAt,
  };
}
export function hasPaidAccess(user, now = Date.now()) {
  const paid = paidEntitlement(user);
  return Boolean(paid.id && PAID_PLANS.includes(paid.plan)
    && ['active', 'cancelled', 'completed'].includes(paid.status)
    && new Date(paid.endsAt).getTime() > now);
}
export function preservePaidAccess(user) {
  if (user.paidSubscriptionId || !hasPaidAccess(user)) return {};
  const paid = paidEntitlement(user);
  return { paidSubscriptionId: paid.id, paidPlan: paid.plan, paidStatus: paid.status, paidThrough: paid.endsAt };
}
export function hasReviewAccess(user, now = Date.now()) {
  if (!user || !user.isActive) return false;
  return (user.plan === 'trial' && new Date(user.trialEndsAt).getTime() > now) || hasPaidAccess(user, now);
}
