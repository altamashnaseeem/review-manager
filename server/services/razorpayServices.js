import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create a subscription order
const createOrder = async (amount, userId) => {
  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // in paise (₹3000 = 300000 paise)
      currency: 'INR',
      receipt: `order_${userId}_${Date.now()}`,
    });
    return order;
  } catch (error) {
    logger.error('Razorpay create order error:', error.message);
    throw error;
  }
};

// Verify payment signature (security check)
const verifyPayment = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

export { createOrder, verifyPayment };
