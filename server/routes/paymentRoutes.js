import express from 'express';
import Razorpay from 'razorpay';
import User from '../models/User.js'; // Adjust path to your Mongoose model

const router = express.Router();

// POST /api/checkout/session
router.post('/checkout/session', async (request, res) => {
  try {
    const { plan, userId } = request.body;
    

    // 1. Map Plan IDs inside the handler so env variables are guaranteed to be loaded
    const PLAN_IDS = {
      monthly: process.env.RAZORPAY_PLAN_MONTHLY_ID,
      quarterly: process.env.RAZORPAY_PLAN_QUARTERLY_ID,
      'semi-annual': process.env.RAZORPAY_PLAN_SEMI_ANNUAL_ID,
    };
     
    if (!plan || !PLAN_IDS[plan] || !userId) {
      return res.status(400).json({ error: 'Missing required plan or user details.' });
    }

    // 2. Fetch user from MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const now = new Date();
    let startAtTimestamp = undefined;

    // 3. Calculate trial credit window
    if (user.trialEndsAt && user.trialEndsAt > now && user.plan === 'trial') {
      startAtTimestamp = Math.floor(user.trialEndsAt.getTime() / 1000);
    }

    // 4. Subscription payload
    const subscriptionOptions = {
      plan_id: PLAN_IDS[plan],
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
    };

    if (startAtTimestamp) {
      subscriptionOptions.start_at = startAtTimestamp;
    }

    // 5. Initialize Razorpay safely inside the request context
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay credentials missing from server environment.' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 6. Create subscription in Razorpay
    const subscription = await razorpay.subscriptions.create(subscriptionOptions);

    // 7. Update user schema
    user.subscriptionId = subscription.id;
    await user.save();

    // 8. Return payload to Express client
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