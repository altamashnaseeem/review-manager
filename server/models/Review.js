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
    // AI generated reply from Claude
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
      enum: ['pending', 'approved', 'posted', 'dismissed'],
      default: 'pending',
    },
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

const Review = mongoose.model('Review', reviewSchema);
export default Review;
