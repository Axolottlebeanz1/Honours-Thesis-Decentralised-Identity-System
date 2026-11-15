const MIN_JWT_SECRET_LENGTH = 32;

const KNOWN_INSECURE_JWT_SECRETS = new Set([
  "dev-secret-change-me",
  "replace-with-a-long-random-string",
  "changeme",
  "change-me",
  "secret",
  "jwt-secret",
  "your-secret-here",
]);

const PLACEHOLDER_PATTERN = /(replace|change[-_ ]?me|your[-_ ]?secret|placeholder|example|dev-secret)/i;

function jwtSecretProblems(secret) {
  const problems = [];
  if (typeof secret !== "string" || secret.trim() === "") {
    problems.push("JWT_SECRET is not set");
    return problems;
  }
  if (KNOWN_INSECURE_JWT_SECRETS.has(secret.trim().toLowerCase()) || PLACEHOLDER_PATTERN.test(secret)) {
    problems.push("JWT_SECRET is a default or placeholder value");
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters`);
  }
  return problems;
}

// Throws an error if the configuration is unsafe to run with and is called once at startup.
function assertSecureConfig(cfg) {
  const problems = jwtSecretProblems(cfg.jwtSecret);
  if (problems.length > 0) {
    const err = new Error(
      `Refusing to start: ${problems.join("; ")}. ` +
        `Set a strong secret in backend/.env, e.g. generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
    err.code = "INSECURE_CONFIG";
    throw err;
  }
}

module.exports = { jwtSecretProblems, assertSecureConfig, MIN_JWT_SECRET_LENGTH };
