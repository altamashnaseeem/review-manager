// middleware/subscriptionCheck.js
export const checkSubscription = async (req, res, next) => {
  const user = req.user; // Assuming your auth middleware populates req.user

  // If the user upgraded to pro, let them pass
  if (user.plan === 'pro') {
    return next();
  }

  // If they are still on a trial, verify the timestamp
  if (user.plan === 'trial') {
    const now = new Date();
    const trialEnd = new Date(user.trialEndsAt);

    if (now > trialEnd) {
      return res.status(402).json({
        success: false,
        message: "Your 7-day trial has expired. Please upgrade to the pro plan to continue using the application."
      });
    }

    return next(); // Trial is still active
  }

  return res.status(403).json({ success: false, message: "Account context invalid." });
};

