import mongoose from 'mongoose';

// Ownership survives replacement of an unpaid checkout, so late callbacks and
// webhooks can still be verified without trusting a client-supplied account ID.
const schema = new mongoose.Schema({
  providerId: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: String, enum: ['monthly', 'quarterly', 'semi-annual'] },
  status: String,
  paidCount: Number,
  periodEndsAt: Date,
}, { timestamps: true });
export default mongoose.model('BillingSubscription', schema);
