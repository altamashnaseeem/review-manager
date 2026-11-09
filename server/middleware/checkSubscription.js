import { hasReviewAccess } from '../services/subscriptionAccess.js';
export const checkSubscription = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (!hasReviewAccess(req.user)) return res.status(403).json({ success: false, message: 'Your trial or subscription has expired.', code: 'SUBSCRIPTION_EXPIRED' });
  next();
};
