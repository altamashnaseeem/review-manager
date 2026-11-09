import mongoose from 'mongoose';
import logger from '../utils/logger.js';
const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    logger.info('MongoDB connected');
    return connection;
  } catch { throw new Error('MongoDB connection failed. Check the configured connection and network access.'); }
};
export default connectDB;
