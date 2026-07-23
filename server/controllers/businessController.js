import Business from '../models/Business.js';
import logger from '../utils/logger.js';
import { google } from 'googleapis';

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// @desc    Get Google OAuth URL for business owner to connect
// @route   GET /api/business/:id/google/connect
// @access  Private
const getGoogleAuthUrl = async (req, res, next) => {
  try {
    const business = await Business.findOne({ 
      _id: req.params.id, 
      owner: req.user.id 
    });
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const oauth2Client = getOAuthClient();

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/business.manage',
      ],
      // Pass business ID in state so we know which business to update
      state: `${business._id}_${req.user.id}`,
    });

    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle Google OAuth callback
// @route   GET /api/business/google/callback
// @access  Private
const handleGoogleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?error=oauth_failed`);
    }

    const [businessId, userId] = state.split('_');

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Get the business account info from Google
    const mybusiness = google.mybusinessaccountmanagement({
      version: 'v1',
      auth: oauth2Client,
    });

    const accountsResponse = await mybusiness.accounts.list();
    const account = accountsResponse.data.accounts?.[0];

    if (!account) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?error=no_business_account`);
    }

    // Get locations
    const mybusinessInfo = google.mybusinessbusinessinformation({
      version: 'v1',
      auth: oauth2Client,
    });

    const locationsResponse = await mybusinessInfo.accounts.locations.list({
      parent: account.name,
    });

    const location = locationsResponse.data.locations?.[0];

    // Save tokens to business
    await Business.findByIdAndUpdate(businessId, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleAccountId: account.name.replace('accounts/', ''),
      googleLocationId: location?.name?.split('/').pop() || null,
    });

    logger.info(`Google Business connected for business ${businessId}`);

    // Redirect back to frontend settings page with success
    res.redirect(`${process.env.FRONTEND_URL}/settings?google=connected`);
  } catch (error) {
    logger.error('Google OAuth callback error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL}/settings?error=oauth_failed`);
  }
};


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



export { addBusiness, getMyBusinesses, getBusiness, updateBusiness, deleteBusiness,getGoogleAuthUrl,handleGoogleCallback };
