import express from 'express';
import {
  getReviews,
  getStats,
  regenerateReply,
  postReply,
  dismissReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/checkSubscription.js'; // 1. Import it

const router = express.Router();

router.use(protect);
router.use(checkSubscription); // 2. Apply globally to all review endpoints

router.get('/:businessId', getReviews);
router.get('/:businessId/stats', getStats);
router.post('/:reviewId/regenerate', regenerateReply);
router.post('/:reviewId/post-reply', postReply);
router.put('/:reviewId/dismiss', dismissReview);

export default router;