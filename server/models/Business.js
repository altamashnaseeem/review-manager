import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    googlePlaceId: {
      type: String,
      required: [true, 'Google Place ID is required'],
      unique: true,
    },
    googleAccessToken: {
      type: String,
      default: null,
    },
    googleRefreshToken: {
      type: String,
      default: null,
    },
    googleAccountId: {
      type: String,
      default: null,
    },
    googleLocationId: {
      type: String,
      default: null,
    },
    alertPhone: {
      type: String,
      required: [true, 'Alert phone number is required'],
    },
    alertEmail: {
      type: String,
      default: null,
    },
    alertOnRating: {
      type: Number,
      default: 3, // alert if rating is 3 or below
    },
    autoReplyEnabled: {
      type: Boolean,
      default: false, // Plan C feature
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastPolledAt: {
      type: Date,
      default: null,
    },
    overallRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Business = mongoose.model('Business', businessSchema);
export default Business;
