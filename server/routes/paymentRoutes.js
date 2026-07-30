import express from 'express';
import Razorpay from 'razorpay';
import User from '../models/User.js'; 

const router = express.Router();

// POST /api/checkout/session
router.post('/session', async (req, res) => {
  try {
    const { plan, userId } = req.body;

    const PLAN_IDS = {
      monthly: process.env.RAZORPAY_PLAN_MONTHLY_ID,
      quarterly: process.env.RAZORPAY_PLAN_QUARTERLY_ID,
      'semi-annual': process.env.RAZORPAY_PLAN_SEMI_ANNUAL_ID,
    };

    if (!plan || !PLAN_IDS[plan] || !userId) {
      return res.status(400).json({ error: 'Missing required plan or user details.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const now = new Date();
    let startAtTimestamp = undefined;

    // SCENARIO 1: Early Upgrade - User has remaining trial time
    if (user.trialEndsAt && new Date(user.trialEndsAt) > now) {
      // Razorpay expects a Unix timestamp in seconds
      startAtTimestamp = Math.floor(new Date(user.trialEndsAt).getTime() / 1000);
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay credentials missing from server environment.' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const subscriptionOptions = {
      plan_id: PLAN_IDS[plan],
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
    };

    // If there is remaining trial time, tell Razorpay to wait until that date to charge
    if (startAtTimestamp) {
      subscriptionOptions.start_at = startAtTimestamp;
    }

    const subscription = await razorpay.subscriptions.create(subscriptionOptions);

    // Update user record: Save subscription tracking info & upgrade the plan type
    user.subscriptionId = subscription.id;
    user.plan = plan; // Changes from 'trial' to 'monthly', 'quarterly', etc.
    await user.save();

    return res.status(200).json({
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      name: user.name,
      email: user.email,
      phone: user.phone
    });
     
  } catch (error) {
    console.error('Razorpay Session Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;