import express from 'express';
import {
  getReviews,
  getStats,
  regenerateReply,
  postReply,
  dismissReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/:businessId', getReviews);
router.get('/:businessId/stats', getStats);
router.post('/:reviewId/regenerate', regenerateReply);
router.post('/:reviewId/post-reply', postReply);
router.put('/:reviewId/dismiss', dismissReview);

export default router;
