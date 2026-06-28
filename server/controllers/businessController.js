import Business from '../models/Business.js';
import logger from '../utils/logger.js';

// @desc    Add a new business
// @route   POST /api/business
// @access  Private
const addBusiness = async (req, res, next) => {
  try {
    const { name, googlePlaceId, alertPhone, alertEmail, alertOnRating } = req.body;

    if (!name || !googlePlaceId || !alertPhone) {
      return res.status(400).json({ success: false, message: 'Name, Google Place ID and alert phone are required' });
    }

    const exists = await Business.findOne({ googlePlaceId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'This business is already registered' });
    }

    const business = await Business.create({
      owner: req.user.id,
      name,
      googlePlaceId,
      alertPhone,
      alertEmail: alertEmail || null,
      alertOnRating: alertOnRating || 3,
    });

    logger.info(`Business added: ${name} by user ${req.user.id}`);

    res.status(201).json({ success: true, business });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all businesses of logged in user
// @route   GET /api/business
// @access  Private
const getMyBusinesses = async (req, res, next) => {
  try {
    const businesses = await Business.find({ owner: req.user.id });
    res.json({ success: true, count: businesses.length, businesses });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single business
// @route   GET /api/business/:id
// @access  Private
const getBusiness = async (req, res, next) => {
  try {
    const business = await Business.findOne({ _id: req.params.id, owner: req.user.id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    res.json({ success: true, business });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business settings
// @route   PUT /api/business/:id
// @access  Private
const updateBusiness = async (req, res, next) => {
  try {
    const business = await Business.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    res.json({ success: true, business });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete business
// @route   DELETE /api/business/:id
// @access  Private
const deleteBusiness = async (req, res, next) => {
  try {
    const business = await Business.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    res.json({ success: true, message: 'Business removed' });
  } catch (error) {
    next(error);
  }
};

export { addBusiness, getMyBusinesses, getBusiness, updateBusiness, deleteBusiness };
