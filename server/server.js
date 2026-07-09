import dotenv from 'dotenv';
dotenv.config();
import dns from "dns"
dns.setServers([
  "1.1.1.1",
  "8.8.8.8"
]);
import app from './app.js';
import connectDB from './config/db.js';
import { startReviewPoller } from './jobs/reviewPoller.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Start the background review polling job
    startReviewPoller();
  });
});
