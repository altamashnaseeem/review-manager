import Review from '../models/Review.js';
import { fetchBusinessReviews, fail } from './googleServices.js';
import { generateReviewReply } from './claudeService.js';
import { sendWhatsAppAlert } from './twilioService.js';
import logger from '../utils/logger.js';

const syncing = new Set();
export async function syncBusinessReviews(business, { notify = false } = {}) {
  const id = String(business._id);
  if (syncing.has(id)) throw fail('Reviews are already syncing. Try again shortly.', 409);
  syncing.add(id);
  try {
    const data = await fetchBusinessReviews(business);
    const initialImport = !business.reviewsSynced;
    const newReviews = [];
    for (const reviewData of data.reviews) {
      const source = business.isDemo ? 'demo' : 'google';
      const result = await Review.updateOne({ business: business._id, googleReviewId: reviewData.googleReviewId }, {
        $set: { ...reviewData, source },
        $setOnInsert: { business: business._id, isNew: !initialImport },
      }, { upsert: true, runValidators: true });
      if (result.upsertedCount) newReviews.push(reviewData.googleReviewId);
    }
    // Remove old SerpAPI records only after the Google import succeeds.
    await Review.deleteMany({ business: business._id, $or: [{ source: 'legacy' }, { source: { $exists: false } }] });
    business.overallRating = data.overallRating;
    business.totalReviews = data.totalReviews;
    business.lastPolledAt = new Date();
    business.reviewsSynced = true;
    await business.save();
    // Historical imports and demos must not send alerts or call paid AI services.
    if (notify && !initialImport && !business.isDemo) {
      for (const googleReviewId of newReviews) {
        try {
          const review = await Review.findOne({ business: business._id, googleReviewId });
          if (review.replyStatus === 'posted' || review.rating > business.alertOnRating) continue;
          review.aiSuggestedReply = await generateReviewReply(review, business.name);
          const sent = await sendWhatsAppAlert({
            to: business.alertPhone, businessName: business.name, reviewerName: review.reviewerName,
            rating: review.rating, comment: review.comment,
            replyLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reviews`,
          });
          review.alertSent = sent;
          if (sent) review.alertSentAt = new Date();
          await review.save();
        } catch { logger.error(`Review notification failed for business ${business._id}`); }
      }
    }
    return data;
  } finally { syncing.delete(id); }
}
