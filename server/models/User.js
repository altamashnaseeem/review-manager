import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never return password in queries
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    plan: {
      type: String,
      // Updated to match all the subscription tiers passing from your frontend/Razorpay workflow
      enum: ['trial','none', 'monthly', 'quarterly', 'semi-annual'],
      default: 'trial',
    },
    
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    paidSubscriptionId: String,
    paidPlan: { type: String, enum: ['monthly', 'quarterly', 'semi-annual'] },
    paidStatus: String,
    paidThrough: Date,
    billingRevision: { type: Number, default: 0 },
    pendingPlan: { type: String, enum: ['monthly', 'quarterly', 'semi-annual'] },
    subscriptionStatus: { type: String, default: null },
    subscriptionEndsAt: { type: Date, default: null },
    billingLockToken: { type: String, select: false },
    billingLockUntil: { type: Date, select: false },
    razorpayCustomerId: {
      type: String,
      default: null,
    },
    subscriptionId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;