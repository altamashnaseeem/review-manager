import express from 'express';
import {
  addBusiness,
  getMyBusinesses,
  getBusiness,
  updateBusiness,
  deleteBusiness,
  getGoogleAuthUrl,
  handleGoogleCallback
} from '../controllers/businessController.js';
import { protect } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/checkSubscription.js'; // 1. Import it

const router = express.Router();

router.use(protect); // All routes still require authentication

// 2. Protect adding a new business, but let them read existing ones
router.route('/')
  .get(getMyBusinesses)
  .post(checkSubscription, addBusiness); // Block adding if subscription is expired

// 3. Protect updating details, but allow viewing/deleting locations
router.route('/:id')
  .get(getBusiness)
  .put(checkSubscription, updateBusiness) // Block profile updates
  .delete(deleteBusiness);

// Google OAuth routes (Keep open so they can reconnect if needed to re-verify setup)
router.get('/:id/google/connect', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);

export default router;