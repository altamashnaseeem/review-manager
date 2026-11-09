import express from 'express';
import {
  addBusiness,
  getMyBusinesses,
  getBusiness,
  updateBusiness,
  deleteBusiness,
} from '../controllers/businessController.js';
import { getGoogleAuthUrl, handleGoogleCallback, completeGoogleConnection, getGoogleLocations, selectGoogleLocation, connectDemo, syncReviews } from '../controllers/googleController.js';
import { protect } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/checkSubscription.js'; // 1. Import it

const router = express.Router();

router.get('/google/callback', handleGoogleCallback);

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
router.post('/:id/google/complete', completeGoogleConnection);
router.get('/:id/google/locations', getGoogleLocations);
router.post('/:id/google/location', checkSubscription, selectGoogleLocation);
router.post('/:id/google/demo', connectDemo);
router.post('/:id/google/sync', checkSubscription, syncReviews);

export default router;