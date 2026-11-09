import Review from '../models/Review.js';
import { fetchBusinessReviews, fail } from './googleServices.js';
import { processReviewAlerts } from './reviewAlerts.js';

const syncing = new Set();
export async function syncBusinessReviews(business, { notify = false } = {}) {
  const id = String(business._id);
  if (syncing.has(id)) throw fail('Reviews are already syncing. Try again shortly.', 409);
  syncing.add(id);
  try {
    const data = await fetchBusinessReviews(business);
    if (business.isDemo) {
      const events = await Review.find({ business: business._id, isDemoEvent: true })
        .select('googleReviewId reviewerName reviewerPhoto rating comment reviewDate googleUpdatedAt -_id').lean();
      data.reviews.push(...events);
      data.totalReviews = data.reviews.length;
      data.overallRating = data.reviews.reduce((sum, review) => sum + review.rating, 0) / (data.reviews.length || 1);
    }
    const initialImport = !business.reviewsSynced;
    for (const reviewData of data.reviews) {
      const source = business.isDemo ? 'demo' : 'google';
      await Review.updateOne({ business: business._id, googleReviewId: reviewData.googleReviewId }, {
        $set: { ...reviewData, source },
        $setOnInsert: { business: business._id, isNew: !initialImport,
          alertEligible: !initialImport && reviewData.rating <= business.alertOnRating && !reviewData.replyStatus,
          alertStatus: !initialImport && reviewData.rating <= business.alertOnRating && !reviewData.replyStatus ? 'pending' : 'skipped',
          alertAttemptCount: 0 },
      }, { upsert: true, runValidators: true });
    }
    // Remove old SerpAPI records only after the Google import succeeds.
    await Review.deleteMany({ business: business._id, $or: [{ source: 'legacy' }, { source: { $exists: false } }] });
    business.overallRating = data.overallRating;
    business.totalReviews = data.totalReviews;
    business.lastPolledAt = new Date();
    business.reviewsSynced = true;
    await business.save();
    if (notify) await processReviewAlerts(business);
    return data;
  } finally { syncing.delete(id); }
}
