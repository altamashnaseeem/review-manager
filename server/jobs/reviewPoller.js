import Business from '../models/Business.js';
import Review from '../models/Review.js';
import { fetchPlaceReviews } from '../services/googleServices.js';
import { generateReviewReply } from '../services/claudeService.js';
import { sendWhatsAppAlert } from '../services/twilioService.js';
import logger from '../utils/logger.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// This job runs every X minutes and checks all businesses for new reviews
const pollAllBusinesses = async () => {
  logger.info('Review poller started...');

  try {
    const businesses = await Business.find({ isActive: true }).populate('owner');

    for (const business of businesses) {
      try {
        await pollBusiness(business);
      } catch (err) {
        logger.error(`Error polling business ${business.name}:`, err.message);
      }
    }

    logger.info(`Review poller completed. Checked ${businesses.length} businesses.`);
  } catch (error) {
    logger.error('Review poller failed:', error.message);
  }
};

const pollBusiness = async (business) => {
  const data = await fetchPlaceReviews(business.googlePlaceId);

  // Update overall rating and total reviews
  business.overallRating = data.overallRating;
  business.totalReviews = data.totalReviews;
  business.lastPolledAt = new Date();
  await business.save();

  for (const reviewData of data.reviews) {
    // Check if review already exists in our DB
    const exists = await Review.findOne({ googleReviewId: reviewData.googleReviewId });
    if (exists) continue; // skip — we already have this review

    // This is a NEW review — save it
    const review = await Review.create({
      business: business._id,
      ...reviewData,
    });

    logger.info(`New review found for ${business.name} - ${reviewData.rating} stars from ${reviewData.reviewerName}`);

    // Only alert + generate AI reply for bad reviews
    if (reviewData.rating <= business.alertOnRating) {
      // Generate AI reply using Claude
      const aiReply = await generateReviewReply(review, business.name);
      review.aiSuggestedReply = aiReply;
      await review.save();

      // Send WhatsApp alert to business owner
      const replyLink = `${FRONTEND_URL}/reviews/${review._id}`;

      await sendWhatsAppAlert({
        to: business.alertPhone,
        businessName: business.name,
        reviewerName: reviewData.reviewerName,
        rating: reviewData.rating,
        comment: reviewData.comment,
        replyLink,
      });

      review.alertSent = true;
      review.alertSentAt = new Date();
      await review.save();
    }
  }
};

// Start the poller with interval
const startReviewPoller = () => {
  const intervalMinutes = parseInt(process.env.REVIEW_POLL_INTERVAL_MINUTES) || 30;
  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(`Review poller scheduled every ${intervalMinutes} minutes`);

  // Run immediately on start
  pollAllBusinesses();

  // Then run every X minutes
  setInterval(pollAllBusinesses, intervalMs);
};

export { startReviewPoller, pollAllBusinesses };
