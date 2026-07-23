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

const router = express.Router();

router.use(protect); // all business routes require login

router.route('/').get(getMyBusinesses).post(addBusiness);
router.route('/:id').get(getBusiness).put(updateBusiness).delete(deleteBusiness);
// Google OAuth routes
router.get('/:id/google/connect', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
export default router;
