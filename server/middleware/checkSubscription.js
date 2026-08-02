export const checkSubscription = async (req, res, next) => {
  try {
    const user = req.user; // Assumes user state payload is attached from your JWT auth middleware
     
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const now = new Date();
    const isTrialExpired = user.trialEndsAt && new Date(user.trialEndsAt) < now;
   
    // Check fallback parameters: If account tier plan is none, and evaluation trial expired
    if (user.plan === 'none' && isTrialExpired) {
      return res.status(403).json({ 
        error: 'Subscription expired.', 
        code: 'SUBSCRIPTION_EXPIRED' 
      });
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal subscription evaluation error.' });
  }
};