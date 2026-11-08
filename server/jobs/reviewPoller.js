import Business from '../models/Business.js';
import { syncBusinessReviews } from '../services/reviewSync.js';
import { demoEnabled } from '../services/googleServices.js';
import { processPendingAlerts } from '../services/reviewAlerts.js';
import logger from '../utils/logger.js';

let running = false;
const pollAllBusinesses = async () => {
  if (running) return;
  running = true;
  try {
    const businesses = await Business.find({ isActive: true, googleConnected: true });
    for (const business of businesses) {
      if (business.isDemo && !demoEnabled()) continue;
      try { await syncBusinessReviews(business, { notify: true }); }
      catch (error) { logger.error(`Error polling business ${business._id}: ${error.message}`); }
    }
  } catch { logger.error('Review poller failed'); }
  finally { running = false; }
};
const startReviewPoller = () => {
  const minutes = Math.max(1, parseInt(process.env.REVIEW_POLL_INTERVAL_MINUTES) || 30);
  pollAllBusinesses();
  const reviewTimer = setInterval(pollAllBusinesses, minutes * 60 * 1000);
  const alertTimer = setInterval(() => processPendingAlerts().catch(() => logger.error('Alert queue failed')), 60000);
  processPendingAlerts().catch(() => logger.error('Alert queue failed'));
  return { stop: () => { clearInterval(reviewTimer); clearInterval(alertTimer); } };
};
export { startReviewPoller, pollAllBusinesses };
