import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import BillingSubscription from './models/BillingSubscription.js';
import connectDB from './config/db.js';
import { validateEnvironment } from './config/environment.js';
import { startReviewPoller } from './jobs/reviewPoller.js';
import logger from './utils/logger.js';

let server, poller;
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutting down after ${signal}`);
  const forced = setTimeout(() => process.exit(1), 25000).unref();
  const closing = server ? new Promise(resolve => server.close(resolve)) : Promise.resolve();
  await poller?.stop();
  await closing;
  await mongoose.disconnect(); clearTimeout(forced);
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown(signal));
try {
  const config = validateEnvironment();
  await connectDB();
  await BillingSubscription.createIndexes();
  server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Server listening on port ${config.port}`);
    if (config.runPoller) poller = startReviewPoller();
  });
  server.on('error', () => { logger.error('HTTP server failed to start'); process.exit(1); });
} catch (error) { logger.error(error.message); await mongoose.disconnect(); process.exitCode = 1; }
