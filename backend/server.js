const app = require("./app");
const config = require("./config");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const { assertSecureConfig } = require("./config/validate");

async function start() {
    try {
    assertSecureConfig(config);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  await connectDB();
  app.listen(config.port, () => logger.info(`API server listening on port ${config.port}`));
}

start();
