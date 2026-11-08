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
      // Legacy identifier; draft businesses use an internal unique placeholder.
      unique: true,
    },
    googleAccessToken: {
      type: String,
      select: false,
      default: null,
    },
    googleRefreshToken: {
      type: String,
      select: false,
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
    googleTokenExpiry: Date,
    googleConnected: { type: Boolean, default: false },
    googleAuthorized: { type: Boolean, default: false },
    googleResourceName: { type: String, unique: true, sparse: true },
    googleOAuthStateHash: { type: String, select: false },
    googleOAuthExpiresAt: { type: Date, select: false },
    isDemo: { type: Boolean, default: false },
    reviewsSynced: { type: Boolean, default: false },
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
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'Alert threshold must be a whole number from 1 to 5' },
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

businessSchema.set('toJSON', { transform(_doc, ret) {
  for (const field of ['googleAccessToken', 'googleRefreshToken', 'googleOAuthStateHash', 'googleOAuthExpiresAt']) delete ret[field];
  return ret;
} });

const Business = mongoose.model('Business', businessSchema);
export default Business;
