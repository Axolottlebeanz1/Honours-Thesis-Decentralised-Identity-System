const { validationResult } = require("express-validator");

// Runs after the express-validator checks. 
// If a field is invalid, it returns a 422 response with details of the fields that need attention.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

module.exports = { validate };
