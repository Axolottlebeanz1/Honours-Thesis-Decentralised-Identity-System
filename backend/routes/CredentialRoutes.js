const express = require("express");
const { param, body } = require("express-validator");
const { requireAuth } = require("../middleware/AuthMiddleware");
const { validate } = require("../utils/validators");
const ctrl = require("../controllers/CredentialController");

const router = express.Router();

const hashParamRule = [param("credentialHash").matches(/^0x[a-fA-F0-9]{64}$/)];
const prepareRules = [
  body("issuerDID").isString().notEmpty(),
  body("subjectDID").isString().notEmpty(),
  body("credentialSubject").isObject(),
  body("type").isArray({ min: 1 }),
];
const issueRules = [
  body("vc").isObject(),
  body("vc.issuer").isString().notEmpty(),
  body("signature").isString().matches(/^0x[a-fA-F0-9]{130}$/),
];
const confirmRules = [
  body("credentialHash").matches(/^0x[a-fA-F0-9]{64}$/),
  body("issuerDID").isString().notEmpty(),
  body("subjectDID").isString().notEmpty(),
  body("ipfsCid").isString().notEmpty(),
];
const presentedRules = [body("vc").isObject()];

router.get("/", requireAuth, ctrl.listCredentials);
router.post("/verify", presentedRules, validate, ctrl.verifyPresentedCredential);
router.get("/:credentialHash/verify", hashParamRule, validate, ctrl.verifyCredential);
router.get("/:credentialHash/document", requireAuth, hashParamRule, validate, ctrl.getCredentialDocument);
router.post("/prepare", requireAuth, prepareRules, validate, ctrl.prepareCredential);
router.post("/issue", requireAuth, issueRules, validate, ctrl.issueCredential);
router.post("/confirm", requireAuth, confirmRules, validate, ctrl.confirmCredential);
router.patch("/:credentialHash/revoke", requireAuth, hashParamRule, validate, ctrl.markRevoked);

module.exports = router;
