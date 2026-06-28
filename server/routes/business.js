import express from 'express';
import {
  addBusiness,
  getMyBusinesses,
  getBusiness,
  updateBusiness,
  deleteBusiness,
} from '../controllers/businessController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // all business routes require login

router.route('/').get(getMyBusinesses).post(addBusiness);
router.route('/:id').get(getBusiness).put(updateBusiness).delete(deleteBusiness);

export default router;
