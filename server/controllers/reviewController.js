import Review from '../models/Review.js';
import Business from '../models/Business.js';
import { generateReviewReply } from '../services/claudeService.js';
import { postReplyToGoogle, demoEnabled } from '../services/googleServices.js';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { processReviewAlerts } from '../services/reviewAlerts.js';
import logger from '../utils/logger.js';

const requireConnection = (business, res) => {
  if (business.googleConnected && business.reviewsSynced && (!business.isDemo || demoEnabled())) return true;
  res.status(409).json({ success: false, code: 'GOOGLE_CONNECTION_REQUIRED', message: 'Connect Google Business, select a location, and sync reviews first.' });
  return false;
};

// @desc    Get all reviews for a business
// @route   GET /api/reviews/:businessId
// @access  Private
const getReviews = async (req, res, next) => {
  try {
    const business = await Business.findOne({ _id: req.params.businessId, owner: req.user.id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    if (!requireConnection(business, res)) return;

    const { rating, status } = req.query;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: 'Page must be positive and limit must be between 1 and 100.' });
    }
    const filter = { business: req.params.businessId };
    if (req.query.reviewId) {
      if (!mongoose.isValidObjectId(req.query.reviewId)) return res.status(400).json({ success: false, message: 'Invalid review ID' });
      filter._id = req.query.reviewId;
    }
    if (rating) filter.rating = Number(rating);
    if (status) filter.replyStatus = status === 'pending' ? { $in: ['pending', 'approved'] } : status;
    if (status === 'pending' && !rating) filter.rating = { $lte: business.alertOnRating };

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

    if (!requireConnection(business, res)) return;

    const totalReviews = await Review.countDocuments({ business: req.params.businessId });
    const pendingReplies = await Review.countDocuments({ business: req.params.businessId, replyStatus: { $in: ['pending', 'approved'] }, rating: { $lte: business.alertOnRating } });
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

    if (!requireConnection(review.business, res)) return;
    if (['posted', 'posting', 'dismissed'].includes(review.replyStatus)) return res.status(409).json({ success: false, message: 'This review is no longer awaiting a reply.' });
    const aiReply = review.business.isDemo ? 'Demo reply: Thank you for your feedback. This reply is for testing only.' : await generateReviewReply(review, review.business.name);
    review.aiReplyError = null;
    review.aiSuggestedReply = aiReply;
    await review.save();

    res.json({ success: true, aiSuggestedReply: aiReply, review });
  } catch (error) {
    next(error);
  }
};

// @desc    Owner approves and posts reply to Google (Plan B core feature)
// @route   POST /api/reviews/:reviewId/post-reply
// @access  Private
const postReply = async (req, res, next) => {
  try {
    const finalReply = typeof req.body.finalReply === 'string' ? req.body.finalReply.trim() : '';
    if (!finalReply || finalReply.length > 4096) return res.status(400).json({ success: false, message: 'Enter a reply between 1 and 4096 characters.' });
    const review = await Review.findById(req.params.reviewId).populate('business');
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (review.business.owner.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (!requireConnection(review.business, res)) return;
    if (review.replyStatus === 'posted') {
      if (review.finalReply !== finalReply) return res.status(409).json({ success: false, message: 'A reply has already been posted for this review.' });
      return res.json({ success: true, message: 'This reply was already posted.', review });
    }
    const claimed = await Review.findOneAndUpdate({
      _id: review._id, $or: [
        { replyStatus: { $in: ['pending', 'approved'] } },
        { replyStatus: 'posting', replyLockUntil: { $lte: new Date() } },
      ],
    }, { $set: {
      replyStatus: 'posting', finalReply, approvedAt: new Date(), approvedBy: req.user.id,
      replyLockUntil: new Date(Date.now() + 180000), replyError: null,
    } }, { new: true });
    if (!claimed) return res.status(409).json({ success: false, message: 'This review is already being posted or has been dismissed. Refresh to check its status.' });
    let result;
    try { result = await postReplyToGoogle(review.business, review.googleReviewId, finalReply); }
    catch (error) {
      await Review.updateOne({ _id: review._id, replyStatus: 'posting' }, {
        $set: { replyStatus: 'approved', replyError: 'Google could not confirm the reply. Retry posting your approved text.' }, $unset: { replyLockUntil: 1 },
      });
      throw error;
    }
    const posted = await Review.findByIdAndUpdate(review._id, {
      $set: { replyStatus: 'posted', repliedAt: new Date(), isNew: false, replyError: null },
      $unset: { replyLockUntil: 1 },
    }, { new: true });
    logger.info(`Owner approved and posted reply for review ${review._id}`);
    res.json({ success: true, message: result.simulated ? 'Demo reply saved locally; nothing was posted to Google.' : 'Approved reply posted to Google successfully', review: posted });
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

    if (!requireConnection(review.business, res)) return;
    const dismissed = await Review.findOneAndUpdate({ _id: review._id, replyStatus: { $in: ['pending', 'approved'] } }, {
      $set: { replyStatus: 'dismissed', isNew: false },
    }, { new: true });
    if (!dismissed) return res.status(409).json({ success: false, message: 'This review is already being posted or was replied to.' });
    res.json({ success: true, message: 'Review dismissed', review: dismissed });
  } catch (error) {
    next(error);
  }
};

const retryAlert = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate('business');
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (review.business.owner.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (!requireConnection(review.business, res)) return;
    const queued = await Review.findOneAndUpdate({ _id: review._id, alertEligible: true, alertStatus: 'failed', alertSent: false }, {
      $set: { alertAttemptCount: 0, alertStatus: 'pending', alertError: null }, $unset: { alertNextAttemptAt: 1, alertLockUntil: 1 },
    }, { new: true });
    if (!queued) return res.status(409).json({ success: false, message: 'Only a failed, unsent alert can be retried.' });
    await processReviewAlerts(review.business);
    res.json({ success: true, review: await Review.findById(review._id) });
  } catch (error) { next(error); }
};

const simulateReview = async (req, res, next) => {
  try {
    if (!demoEnabled()) return res.status(404).json({ success: false, message: 'Development demo is disabled.' });
    const business = await Business.findOne({ _id: req.params.businessId, owner: req.user.id, isDemo: true });
    if (!business) return res.status(404).json({ success: false, message: 'Demo business not found' });
    if (!requireConnection(business, res)) return;
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 4096) return res.status(400).json({ success: false, message: 'Choose a rating from 1 to 5 and a comment under 4096 characters.' });
    const eligible = rating <= business.alertOnRating;
    const review = await Review.create({
      business: business._id, googleReviewId: `demo-event-${randomUUID()}`, source: 'demo', isDemoEvent: true,
      reviewerName: 'Simulated customer', rating, comment, reviewDate: new Date(), googleUpdatedAt: new Date(),
      alertEligible: eligible, alertStatus: eligible ? 'pending' : 'skipped',
    });
    const [totals] = await Review.aggregate([{ $match: { business: business._id } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]);
    business.totalReviews = totals.count; business.overallRating = totals.average; await business.save();
    await processReviewAlerts(business);
    res.status(201).json({ success: true, review: await Review.findById(review._id),
      message: eligible ? 'Demo alert simulated and AI draft prepared. No WhatsApp message was sent.' : 'Rating is above your threshold. No alert was triggered.' });
  } catch (error) { next(error); }
};

export { retryAlert, simulateReview, getReviews, getStats, regenerateReply, postReply, dismissReview };
