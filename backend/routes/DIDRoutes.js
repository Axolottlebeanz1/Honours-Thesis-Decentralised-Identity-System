const express = require("express");
const { param, body } = require("express-validator");
const { requireAuth } = require("../middleware/AuthMiddleware");
const { validate } = require("../utils/validators");
const ctrl = require("../controllers/DIDController");

const router = express.Router();

const addressParamRule = [param("address").isEthereumAddress()];
const registerDIDRules = [
  body("did").isString().notEmpty(),
  body("didDocument").isObject(),
];

router.get("/", ctrl.listDIDs);
router.get("/:address/document", requireAuth, addressParamRule, validate, ctrl.getDIDDocument);
router.get("/:address", addressParamRule, validate, ctrl.resolveDID);
router.post("/", requireAuth, registerDIDRules, validate, ctrl.prepareDID);
router.patch("/:address/confirm", requireAuth, addressParamRule, validate, ctrl.confirmDID);

module.exports = router;
