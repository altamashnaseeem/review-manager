import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },
    googleReviewId: {
      type: String,
      required: true,
      unique: true,
    },
    source: { type: String, enum: ['google', 'demo', 'legacy'], default: 'legacy' },
    googleUpdatedAt: Date,
    reviewerName: {
      type: String,
      default: 'Anonymous',
    },
    reviewerPhoto: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
    },
    reviewDate: {
      type: Date,
      required: true,
    },
    // AI generated draft; posting always requires owner approval
    aiSuggestedReply: {
      type: String,
      default: null,
    },
    // What owner edited (if any) before posting
    finalReply: {
      type: String,
      default: null,
    },
    replyStatus: {
      type: String,
      enum: ['pending', 'approved', 'posting', 'posted', 'dismissed'],
      default: 'pending',
    },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    replyLockUntil: { type: Date, select: false },
    replyError: { type: String, default: null },
    demoWhatsAppRequested: { type: Boolean, default: false },
    isDemoEvent: { type: Boolean, default: false },
    alertEligible: { type: Boolean, default: false },
    alertStatus: { type: String, enum: ['pending', 'sending', 'accepted', 'failed', 'simulated', 'skipped'], default: 'skipped' },
    alertAttemptCount: { type: Number, default: 0 },
    alertNextAttemptAt: Date,
    alertLockUntil: { type: Date, select: false },
    alertError: { type: String, default: null },
    alertMessageSid: String,
    alertPreview: String,
    aiReplyError: { type: String, default: null },
    // When owner clicked "Post Reply"
    repliedAt: {
      type: Date,
      default: null,
    },
    // Was alert sent to owner
    alertSent: {
      type: Boolean,
      default: false,
    },
    alertSentAt: {
      type: Date,
      default: null,
    },
    isNew: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ business: 1, alertEligible: 1, alertSent: 1, alertNextAttemptAt: 1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
