const mongoose = require("mongoose");
const config = require("./index");
const logger = require("../utils/logger");

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info(`MongoDB connected: ${config.mongoUri}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
