const NodeCache = require("node-cache");

// Temporarily caches blockchain reads, such as DID lookups and credential status checks. 
// This makes repeat lookups quicker.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl),
  del: (key) => cache.del(key),
  flush: () => cache.flushAll(),
};
