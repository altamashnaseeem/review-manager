import Review from '../models/Review.js';
import Business from '../models/Business.js';
import { generateReviewReply } from './claudeService.js';
import { sendWhatsAppAlert } from './twilioService.js';
import { demoEnabled, demoWhatsAppEnabled } from './googleServices.js';
import logger from '../utils/logger.js';

export const MAX_ALERT_ATTEMPTS = 5;
export const demoDraft = 'Demo reply: Thank you for your feedback. We are sorry your experience fell short. Please contact our team so we can help. This is a local test reply.';
export function approvalLink(businessId, reviewId) {
  const url = new URL('/reviews', process.env.FRONTEND_URL || 'http://localhost:3000');
  url.searchParams.set('business', String(businessId));
  url.searchParams.set('review', String(reviewId));
  return url.toString();
}

export async function processReviewAlerts(business, { generateReply = generateReviewReply, sendAlert = sendWhatsAppAlert } = {}) {
  if (!business.isActive || !business.googleConnected || !business.reviewsSynced) return;
  if (business.isDemo && !demoEnabled()) return;
  const now = new Date();
  const candidates = await Review.find({
    ...(business.isDemo && !demoWhatsAppEnabled() ? { demoWhatsAppRequested: { $ne: true } } : {}),
    business: business._id, alertEligible: true, alertSent: { $ne: true },
    alertStatus: { $nin: ['simulated', 'skipped'] },
    alertAttemptCount: { $lt: MAX_ALERT_ATTEMPTS }, rating: { $lte: business.alertOnRating },
    replyStatus: { $in: ['pending', 'approved'] },
    $and: [
      { $or: [{ alertNextAttemptAt: { $exists: false } }, { alertNextAttemptAt: { $lte: now } }] },
      { $or: [{ alertLockUntil: { $exists: false } }, { alertLockUntil: { $lte: now } }] },
    ],
  }).select('_id').limit(100);
  for (const candidate of candidates) {
    // The database lease prevents overlapping workers from sending the same alert.
    const review = await Review.findOneAndUpdate({
      ...(business.isDemo && !demoWhatsAppEnabled() ? { demoWhatsAppRequested: { $ne: true } } : {}),
      _id: candidate._id, alertSent: { $ne: true }, alertStatus: { $nin: ['simulated', 'skipped'] },
      replyStatus: { $in: ['pending', 'approved'] }, alertAttemptCount: { $lt: MAX_ALERT_ATTEMPTS },
      $or: [{ alertLockUntil: { $exists: false } }, { alertLockUntil: { $lte: now } }],
    }, { $set: { alertStatus: 'sending', alertLockUntil: new Date(Date.now() + 180000) }, $inc: { alertAttemptCount: 1 } }, { new: true });
    if (!review) continue;
    try {
      if (!review.aiSuggestedReply) {
        try {
          review.aiSuggestedReply = business.isDemo ? demoDraft : await generateReply(review, business.name);
          review.aiReplyError = null;
        } catch { review.aiReplyError = 'AI draft unavailable. Generate one later or write your own reply.'; }
        await review.save();
      }
      const details = {
        to: business.alertPhone, businessName: business.isDemo ? `${business.name} (DEMO TEST)` : business.name, reviewerName: review.reviewerName,
        rating: review.rating, comment: review.comment, aiSuggestedReply: review.aiSuggestedReply,
        replyLink: approvalLink(business._id, review._id),
      };
      const sendRealWhatsApp = !business.isDemo || (review.isDemoEvent && review.demoWhatsAppRequested && demoWhatsAppEnabled());
      const result = sendRealWhatsApp ? await sendAlert(details) : null;
      if (sendRealWhatsApp && !result?.sid) throw new Error('No Twilio message confirmation');
      await Review.updateOne({ _id: review._id }, {
        $set: {
          alertStatus: sendRealWhatsApp ? 'accepted' : 'simulated', alertSent: sendRealWhatsApp,
          alertSentAt: new Date(), alertError: null,
          ...(result ? { alertMessageSid: result.sid } : { alertPreview: `Demo WhatsApp alert: ${review.rating}-star review for ${business.name}. Review and approve: ${details.replyLink}` }),
        }, $unset: { alertLockUntil: 1, alertNextAttemptAt: 1 },
      });
    } catch {
      await Review.updateOne({ _id: review._id }, {
        $set: { alertStatus: 'failed', alertError: 'WhatsApp alert failed. Check Twilio configuration, templates, and message logs.',
          alertNextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** (review.alertAttemptCount - 1)) * 60000) },
        $unset: { alertLockUntil: 1 },
      });
      logger.error(`WhatsApp alert failed for review ${review._id}; attempt ${review.alertAttemptCount}`);
    }
  }
}

let processing = false;
export async function processPendingAlerts() {
  if (processing) return;
  processing = true;
  try {
    await Review.updateMany({ replyStatus: 'posting', replyLockUntil: { $lte: new Date() } }, {
      $set: { replyStatus: 'approved', replyError: 'Posting was interrupted. Check Google and retry your approved reply.' }, $unset: { replyLockUntil: 1 },
    });
    const businesses = await Business.find({ isActive: true, googleConnected: true, reviewsSynced: true });
    for (const business of businesses) {
      try { await processReviewAlerts(business); }
      catch { logger.error(`Alert queue processing failed for business ${business._id}`); }
    }
  } finally { processing = false; }
}
