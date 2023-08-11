const {parsed: localEnv} = require("dotenv").config();

module.exports = {
  trailingSlash: false,
  env: localEnv || {},
};
