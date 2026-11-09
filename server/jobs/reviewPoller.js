import Business from '../models/Business.js';
import { syncBusinessReviews } from '../services/reviewSync.js';
import { demoEnabled } from '../services/googleServices.js';
import { processPendingAlerts } from '../services/reviewAlerts.js';
import { hasReviewAccess } from '../services/subscriptionAccess.js';
import logger from '../utils/logger.js';

let running = false;
const pollAllBusinesses = async () => {
  if (running) return;
  running = true;
  try {
    const businesses = await Business.find({ isActive: true, googleConnected: true }).populate('owner');
    for (const business of businesses) {
      if (!hasReviewAccess(business.owner) || (business.isDemo && !demoEnabled())) continue;
      try { await syncBusinessReviews(business, { notify: true }); }
      catch (error) { logger.error(`Error polling business ${business._id}: ${error.message}`); }
    }
  } catch { logger.error('Review poller failed'); }
  finally { running = false; }
};

export function startReviewPoller({
  pollReviews = pollAllBusinesses, retryAlerts = processPendingAlerts,
  intervalMinutes = Number(process.env.REVIEW_POLL_INTERVAL_MINUTES || 30),
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
} = {}) {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) throw new Error('Invalid review polling interval');
  let stopped = false, reviewFlight, alertFlight;
  const reviews = () => {
    if (stopped || reviewFlight) return reviewFlight;
    reviewFlight = Promise.resolve().then(pollReviews).catch(() => logger.error('Review polling failed')).finally(() => { reviewFlight = null; });
    return reviewFlight;
  };
  const alerts = () => {
    if (stopped || alertFlight) return alertFlight;
    alertFlight = Promise.resolve().then(retryAlerts).catch(() => logger.error('Alert retry queue failed')).finally(() => { alertFlight = null; });
    return alertFlight;
  };
  // Run immediately, then on fixed intervals; slow runs cannot overlap.
  reviews(); alerts();
  const reviewTimer = setIntervalFn(reviews, intervalMinutes * 60000);
  const alertTimer = setIntervalFn(alerts, 60000);
  logger.info(`Review checks scheduled every ${intervalMinutes} minute(s); alert retries every minute`);
  return { stop: async () => {
    stopped = true; clearIntervalFn(reviewTimer); clearIntervalFn(alertTimer);
    await Promise.allSettled([reviewFlight, alertFlight]);
  } };
}
export { pollAllBusinesses };
