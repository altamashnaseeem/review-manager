import Review from '../models/Review.js';
import Business from '../models/Business.js';
import { generateReviewReply } from '../services/claudeService.js';
import { postReplyToGoogle } from '../services/googleServices.js';
import logger from '../utils/logger.js';

// @desc    Get all reviews for a business
// @route   GET /api/reviews/:businessId
// @access  Private
const getReviews = async (req, res, next) => {
  try {
    const business = await Business.findOne({ _id: req.params.businessId, owner: req.user.id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const { rating, status, page = 1, limit = 20 } = req.query;
    const filter = { business: req.params.businessId };

    if (rating) filter.rating = Number(rating);
    if (status) filter.replyStatus = status;

    const skip = (page - 1) * limit;
    const reviews = await Review.find(filter)
      .sort({ reviewDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats for a business
// @route   GET /api/reviews/:businessId/stats
// @access  Private
const getStats = async (req, res, next) => {
  try {
    const business = await Business.findOne({ _id: req.params.businessId, owner: req.user.id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const totalReviews = await Review.countDocuments({ business: req.params.businessId });
    const pendingReplies = await Review.countDocuments({ business: req.params.businessId, replyStatus: 'pending', rating: { $lte: business.alertOnRating } });
    const postedReplies = await Review.countDocuments({ business: req.params.businessId, replyStatus: 'posted' });

    // Rating breakdown
    const ratingBreakdown = await Review.aggregate([
      { $match: { business: business._id } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    // Last 30 days reviews
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentReviews = await Review.countDocuments({
      business: req.params.businessId,
      reviewDate: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      stats: {
        totalReviews,
        pendingReplies,
        postedReplies,
        overallRating: business.overallRating,
        recentReviews,
        ratingBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate AI reply for a review
// @route   POST /api/reviews/:reviewId/regenerate
// @access  Private
const regenerateReply = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate('business');
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Make sure this review belongs to the logged-in user
    if (review.business.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const aiReply = await generateReviewReply(review, review.business.name);
    review.aiSuggestedReply = aiReply;
    await review.save();

    res.json({ success: true, aiSuggestedReply: aiReply });
  } catch (error) {
    next(error);
  }
};

// @desc    Owner approves and posts reply to Google (Plan B core feature)
// @route   POST /api/reviews/:reviewId/post-reply
// @access  Private
const postReply = async (req, res, next) => {
  try {
    const { finalReply } = req.body;

    if (!finalReply) {
      return res.status(400).json({ success: false, message: 'Reply text is required' });
    }

    const review = await Review.findById(req.params.reviewId).populate('business');
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.business.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Post to Google
    await postReplyToGoogle(review.business, review.googleReviewId, finalReply);

    review.finalReply = finalReply;
    review.replyStatus = 'posted';
    review.repliedAt = new Date();
    review.isNew = false;
    await review.save();

    logger.info(`Reply posted for review ${review._id}`);

    res.json({ success: true, message: 'Reply posted to Google successfully', review });
  } catch (error) {
    next(error);
  }
};

// @desc    Dismiss a review (no reply needed)
// @route   PUT /api/reviews/:reviewId/dismiss
// @access  Private
const dismissReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate('business');
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.business.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    review.replyStatus = 'dismissed';
    review.isNew = false;
    await review.save();

    res.json({ success: true, message: 'Review dismissed' });
  } catch (error) {
    next(error);
  }
};

export { getReviews, getStats, regenerateReply, postReply, dismissReview };
