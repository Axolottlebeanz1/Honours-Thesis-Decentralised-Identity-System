# Prototype evaluation results

Generated 2026-11-10T12:59:11.572Z

**Environment:** Node v24.21.0; win32 10.0.26200 (x64); AMD Ryzen 7 5800X 8-Core Processor              (16 cores, 17.1 GB)

| Suite | Run at | Network / target | Iterations | Checks passed |
|---|---|---|--:|--:|
| chain | 2026-11-10T12:58:16.250Z | hardhat | 25 | 24/24 |
| ipfs | 2026-11-10T12:59:01.943Z | http://127.0.0.1:5001 | 15 | 20/20 |
| auth | 2026-11-10T12:58:18.627Z | in-process | 200 | 28/28 |
| e2e | 2026-11-10T12:59:09.606Z | hardhat | 10 | 11/11 |

## Smart contracts: gas, latency and access control

### Measurements

**Gas (units)**

| Metric | Unit | n | Mean | Median | P95 | Min | Max | Std dev |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| registerDID.CIDv0.gas | gas | 13 | 251,129 | 251,129 | 251,129 | 251,129 | 251,129 | 0.00 |
| registerDID.CIDv1.gas | gas | 12 | 251,285 | 251,285 | 251,285 | 251,285 | 251,285 | 0.00 |
| updateDID.gas | gas | 25 | 46,705 | 50,737 | 50,737 | 42,337 | 50,737 | 4,283 |
| registerCredential.gas | gas | 25 | 78,307 | 78,309 | 78,309 | 78,285 | 78,309 | 6.00 |
| revokeCredential.gas | gas | 25 | 51,346 | 51,348 | 51,348 | 51,324 | 51,348 | 6.00 |
| deactivateDID.gas | gas | 25 | 30,174 | 30,174 | 30,174 | 30,174 | 30,174 | 0.00 |

**Latency (ms)**

| Metric | Unit | n | Mean | Median | P95 | Min | Max | Std dev |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| registerDID.CIDv0.latencyMs | ms | 13 | 2.75 | 1.23 | 10.95 | 0.99 | 10.95 | 2.97 |
| registerDID.CIDv1.latencyMs | ms | 12 | 1.84 | 1.13 | 5.80 | 1.02 | 5.80 | 1.66 |
| updateDID.latencyMs | ms | 25 | 1.65 | 0.92 | 4.66 | 0.81 | 4.70 | 1.51 |
| resolveDID.readMs | ms | 25 | 0.56 | 0.47 | 0.69 | 0.41 | 2.45 | 0.40 |
| hasActiveDID.readMs | ms | 25 | 0.34 | 0.33 | 0.42 | 0.29 | 0.43 | 0.04 |
| registerCredential.latencyMs | ms | 25 | 1.57 | 0.91 | 4.15 | 0.79 | 4.18 | 1.28 |
| isRevoked.readMs | ms | 25 | 0.27 | 0.26 | 0.34 | 0.24 | 0.41 | 0.04 |
| getRecord.readMs | ms | 25 | 0.34 | 0.33 | 0.43 | 0.30 | 0.44 | 0.04 |
| revokeCredential.latencyMs | ms | 25 | 1.50 | 0.81 | 4.43 | 0.73 | 5.24 | 1.44 |
| deactivateDID.latencyMs | ms | 25 | 1.48 | 0.81 | 4.26 | 0.72 | 4.26 | 1.36 |

**Estimated cost per operation** (USD @ 20 gwei, ETH=$3000 (assumed); gas price and ETH/USD are assumptions)

| Operation | Mean gas | USD |
|---|--:|--:|
| registerDID.CIDv0 | 251,129 | $15.07 |
| registerDID.CIDv1 | 251,285 | $15.08 |
| updateDID | 46,705 | $2.80 |
| registerCredential | 78,307 | $4.70 |
| revokeCredential | 51,346 | $3.08 |
| deactivateDID | 30,174 | $1.81 |

**Deployment and other values**

| Item | Value | Unit |
|---|---|---|
| deploy.DIDRegistry.gas | 754421 | gas |
| deploy.CredentialRegistry.gas | 405932 | gas |
| registerCredential.calldataBytes | 36 | bytes |

### Checks

**Checks: 24/24 passed**

| ID | Category | Check | Expected | Actual | Result |
|---|---|---|---|---|---|
| F1 | functional | DID registration stores the correct details and sets it as active | match | match | PASS |
| F2 | functional | DID registration records a timestamp | > 0 | 1794315626 | PASS |
| F3 | functional | DID document CID is updated correctly | bafybbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | bafybbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | PASS |
| F4 | functional | DIDUpdated event is emitted after an update | DIDUpdated | DIDUpdated | PASS |
| F5 | functional | active DID check returns the correct result for registered and unknown users | true,false | true,false | PASS |
| F6 | functional | credential registration event is emitted | CredentialRegistered | CredentialRegistered | PASS |
| F7 | functional | credential is not revoked when first registered | false | false | PASS |
| F8 | functional | credential is marked as revoked after revocation | true | true | PASS |
| F9 | functional | unknown credential hash is not marked as revoked | false | false | PASS |
| S1 | security | duplicate DID registration from same address is rejected | rejected: already has a registered DID | rejected | PASS |
| S2 | security | non-owner cannot update another address's DID | rejected: no registered DID | rejected | PASS |
| S3 | security | non-owner cannot deactivate another address's DID | rejected: no registered DID | rejected | PASS |
| S4 | security | resolving an unregistered address reverts | rejected: no DID registered | rejected | PASS |
| S5 | security | empty DID string rejected | rejected: empty DID | rejected | PASS |
| S6 | security | empty CID rejected | rejected: empty docCID | rejected | PASS |
| S7 | security | address without an active DID cannot register a credential | rejected: no active DID | rejected | PASS |
| S8 | security | duplicate credential hash rejected | rejected: already registered | rejected | PASS |
| S9 | security | non-issuer cannot revoke a credential | rejected: not the issuer | rejected | PASS |
| S10 | security | revoking an already-revoked credential is rejected | rejected: already revoked | rejected | PASS |
| S11 | security | revoking an unregistered credential is rejected | rejected: not registered | rejected | PASS |
| S12 | security | deactivated DID cannot be updated | rejected: deactivated | rejected | PASS |
| S13 | security | issuer with a deactivated DID cannot register new credentials | rejected: no active DID | rejected | PASS |
| S14 | security | CredentialRegistry constructor rejects zero address | rejected: zero address | rejected | PASS |
| P1 | privacy | registerCredential calldata is selector (4 B) + one bytes32 hash (32 B) only | 36 bytes | 36 bytes | PASS |

## IPFS storage layer

### Measurements

| Metric | Unit | n | Mean | Median | P95 | Min | Max | Std dev |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| encrypt.512B | ms | 15 | 0.06 | 0.06 | 0.08 | 0.05 | 0.08 | 0.01 |
| decrypt.512B | ms | 15 | 0.04 | 0.03 | 0.15 | 0.02 | 0.15 | 0.03 |
| pin(encrypt+add).512B | ms | 15 | 138.67 | 11.72 | 1,915 | 10.61 | 1,915 | 491.44 |
| fetch(cat+decrypt).512B | ms | 15 | 1.16 | 1.07 | 2.52 | 0.78 | 2.52 | 0.41 |
| encrypt.1KB | ms | 15 | 0.05 | 0.05 | 0.07 | 0.04 | 0.07 | 0.01 |
| decrypt.1KB | ms | 15 | 0.03 | 0.03 | 0.04 | 0.02 | 0.04 | 0.00 |
| pin(encrypt+add).1KB | ms | 15 | 12.83 | 11.65 | 26.27 | 10.19 | 26.27 | 3.89 |
| fetch(cat+decrypt).1KB | ms | 15 | 0.97 | 0.93 | 1.32 | 0.81 | 1.32 | 0.15 |
| encrypt.10KB | ms | 15 | 0.08 | 0.07 | 0.11 | 0.07 | 0.11 | 0.01 |
| decrypt.10KB | ms | 15 | 0.05 | 0.05 | 0.08 | 0.04 | 0.08 | 0.01 |
| pin(encrypt+add).10KB | ms | 15 | 13.39 | 13.28 | 15.35 | 11.67 | 15.35 | 1.14 |
| fetch(cat+decrypt).10KB | ms | 15 | 1.14 | 1.06 | 1.79 | 0.98 | 1.79 | 0.21 |
| encrypt.100KB | ms | 15 | 0.34 | 0.32 | 0.52 | 0.24 | 0.52 | 0.07 |
| decrypt.100KB | ms | 15 | 0.21 | 0.20 | 0.36 | 0.17 | 0.36 | 0.05 |
| pin(encrypt+add).100KB | ms | 15 | 15.10 | 14.29 | 19.20 | 13.34 | 19.20 | 1.71 |
| fetch(cat+decrypt).100KB | ms | 15 | 2.36 | 2.32 | 2.55 | 2.12 | 2.55 | 0.13 |
| encrypt.1MB | ms | 15 | 2.88 | 2.81 | 4.03 | 2.04 | 4.03 | 0.58 |
| decrypt.1MB | ms | 15 | 2.96 | 2.89 | 3.90 | 1.99 | 3.90 | 0.54 |
| pin(encrypt+add).1MB | ms | 15 | 34.46 | 29.43 | 51.62 | 24.26 | 51.62 | 9.34 |
| fetch(cat+decrypt).1MB | ms | 15 | 16.13 | 16.08 | 21.44 | 13.15 | 21.44 | 2.13 |
| concurrent.1.batchMs | ms | 1 | 13.56 | 13.56 | 13.56 | 13.56 | 13.56 | 0.00 |
| concurrent.1.opsPerSec | ops/s | 1 | 73.73 | 73.73 | 73.73 | 73.73 | 73.73 | 0.00 |
| concurrent.5.batchMs | ms | 1 | 35.51 | 35.51 | 35.51 | 35.51 | 35.51 | 0.00 |
| concurrent.5.opsPerSec | ops/s | 1 | 140.80 | 140.80 | 140.80 | 140.80 | 140.80 | 0.00 |
| concurrent.10.batchMs | ms | 1 | 74.36 | 74.36 | 74.36 | 74.36 | 74.36 | 0.00 |
| concurrent.10.opsPerSec | ops/s | 1 | 134.47 | 134.47 | 134.47 | 134.47 | 134.47 | 0.00 |
| concurrent.25.batchMs | ms | 1 | 170.77 | 170.77 | 170.77 | 170.77 | 170.77 | 0.00 |
| concurrent.25.opsPerSec | ops/s | 1 | 146.40 | 146.40 | 146.40 | 146.40 | 146.40 | 0.00 |

| Item | Value | Unit |
|---|---|---|
| ipfs.agent | kubo/0.43.0 |  |
| size.512B.plaintextBytes | 495 | bytes |
| size.512B.envelopeBytes | 1100 | bytes |
| size.512B.overheadRatio | 2.222 | x |
| size.1KB.plaintextBytes | 1007 | bytes |
| size.1KB.envelopeBytes | 2124 | bytes |
| size.1KB.overheadRatio | 2.109 | x |
| size.10KB.plaintextBytes | 10223 | bytes |
| size.10KB.envelopeBytes | 20556 | bytes |
| size.10KB.overheadRatio | 2.011 | x |
| size.100KB.plaintextBytes | 102383 | bytes |
| size.100KB.envelopeBytes | 204876 | bytes |
| size.100KB.overheadRatio | 2.001 | x |
| size.1MB.plaintextBytes | 1048559 | bytes |
| size.1MB.envelopeBytes | 2097228 | bytes |
| size.1MB.overheadRatio | 2 | x |
| missingCid.behaviour | returned after 9 ms |  |

### Checks

**Checks: 20/20 passed**

| ID | Category | Check | Expected | Actual | Result |
|---|---|---|---|---|---|
| I0 | availability | IPFS node reachable via HTTP API | reachable | reachable | PASS |
| I-RT-512B | integrity | 15x round trip of 512B payload returns identical JSON | all equal | all equal | PASS |
| I-RT-1KB | integrity | 15x round trip of 1KB payload returns identical JSON | all equal | all equal | PASS |
| I-RT-10KB | integrity | 15x round trip of 10KB payload returns identical JSON | all equal | all equal | PASS |
| I-RT-100KB | integrity | 15x round trip of 100KB payload returns identical JSON | all equal | all equal | PASS |
| I-RT-1MB | integrity | 15x round trip of 1MB payload returns identical JSON | all equal | all equal | PASS |
| I1 | confidentiality | raw IPFS bytes do not contain the DID string | absent | absent | PASS |
| I2 | confidentiality | raw IPFS bytes do not contain the wallet address | absent | absent | PASS |
| I3 | confidentiality | raw IPFS bytes do not contain DID-document field names (e.g. 'verificationMethod') | absent | absent | PASS |
| I4 | confidentiality | stored object is only { alg, iv, ciphertext, tag } | alg,ciphertext,iv,tag | alg,ciphertext,iv,tag | PASS |
| I5 | confidentiality | decryption with a different key fails | failed | failed | PASS |
| I6 | integrity | CID equals hash recomputed from the bytes fetched (self-certifying) | QmNvFaozU21HYAD7ZAWe2jGthHyfvMkUsjjxkzCNCmL9iz | QmNvFaozU21HYAD7ZAWe2jGthHyfvMkUsjjxkzCNCmL9iz | PASS |
| I7 | integrity | altering one byte yields a different CID | different | different | PASS |
| I8-ciphertext | integrity | flipping one bit of the stored ciphertext is detected on decrypt (GCM tag) | rejected | rejected | PASS |
| I8-iv | integrity | flipping one bit of the stored iv is detected on decrypt (GCM tag) | rejected | rejected | PASS |
| I8-tag | integrity | flipping one bit of the stored tag is detected on decrypt (GCM tag) | rejected | rejected | PASS |
| I8-bulk | integrity | 200 random single-bit ciphertext corruptions are all rejected | 200/200 | 200/200 | PASS |
| I8-legacy | integrity | envelope without alg/tag (legacy CBC format) is refused | rejected | rejected | PASS |
| I9 | privacy | identical plaintext pinned twice yields different CIDs (random IV prevents linkage) | different | different | PASS |
| I10 | availability | pinned CID is listed as a recursive pin on the local node | pinned | pinned | PASS |

## Wallet-signature authentication

### Measurements

| Metric | Unit | n | Mean | Median | P95 | Min | Max | Std dev |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| login.nonceIssueMs | ms | 200 | 1.50 | 1.43 | 1.94 | 1.15 | 2.43 | 0.25 |
| login.clientSignMs | ms | 200 | 0.39 | 0.36 | 0.52 | 0.33 | 0.88 | 0.06 |
| login.serverVerifyMs | ms | 200 | 3.21 | 3.10 | 3.98 | 2.75 | 5.72 | 0.41 |
| login.fullLoginMs | ms | 200 | 5.10 | 4.95 | 6.10 | 4.29 | 8.80 | 0.64 |
| concurrent.10.batchMs | ms | 1 | 45.51 | 45.51 | 45.51 | 45.51 | 45.51 | 0.00 |
| concurrent.10.loginsPerSec | logins/s | 1 | 219.73 | 219.73 | 219.73 | 219.73 | 219.73 | 0.00 |
| concurrent.50.batchMs | ms | 1 | 233.70 | 233.70 | 233.70 | 233.70 | 233.70 | 0.00 |
| concurrent.50.loginsPerSec | logins/s | 1 | 213.95 | 213.95 | 213.95 | 213.95 | 213.95 | 0.00 |

| Item | Value | Unit |
|---|---|---|
| nonce.bitOnesRatio | 0.4997 | (~0.5 expected) |
| server.storesSecretPerUser | No - only transient nonce per address (in-memory) ; no password or password hash exists |  |

### Checks

**Checks: 28/28 passed**

| ID | Category | Check | Expected | Actual | Result |
|---|---|---|---|---|---|
| A-C10 | functional | 10 concurrent logins all succeed | 10/10 | 10/10 | PASS |
| A-C50 | functional | 50 concurrent logins all succeed | 50/50 | 50/50 | PASS |
| A1 | functional | valid signature returns 200 and a JWT | 200 + token | 200 token | PASS |
| A2 | privacy | JWT payload contains only address/iat/exp (no secrets or PII) | address,exp,iat | address,exp,iat | PASS |
| A3 | functional | issued JWT is accepted by a protected route (not 401) | != 401 | 422 | PASS |
| S1 | security | Reused signature with an already-used nonce | 400 | 400 | PASS |
| S2 | security | signature from a different wallet is rejected | 401 | 401 | PASS |
| S3 | security | verify without a valid nonce is rejected | 400 | 400 | PASS |
| S4 | security | Invalid signature that should not crash the server | 401 | 401 | PASS |
| S5 | security | Signature using an old or replaced nonce | 401 | 401 | PASS |
| S6 | security | expired nonce is rejected | 400 | 400 | PASS |
| S7 | security | Using wallet A's challenge to authenticate wallet B | 401 | 401 | PASS |
| S8 | functional | address case (checksum vs lowercase) does not break login | 200 | 200 | PASS |
| S9 | security | protected route without token is rejected | 401 | 401 | PASS |
| S10 | security | JWT with altered signature is rejected | 401 | 401 | PASS |
| S11 | security | JWT signed with a different secret is rejected | 401 | 401 | PASS |
| S12 | security | unsigned (alg=none) JWT is rejected | 401 | 401 | PASS |
| S13 | security | JWT secret is set, is not a default/placeholder value, and is at least 32 characters | no problems | custom, 96 characters | PASS |
| S14 | security | decrypted DID document endpoint requires a session | 401 | 401 | PASS |
| S15 | security | decrypted credential contents endpoint requires a session | 401 | 401 | PASS |
| S16 | security | credential listing requires a session | 401 | 401 | PASS |
| S17 | security | credential issuance requires a session | 401 | 401 | PASS |
| S18 | security | cannot prepare a credential under another wallet's issuer DID | 403 | 403 | PASS |
| S19 | security | cannot index/confirm another address's DID | 403 | 403 | PASS |
| S20 | security | cannot pin a DID document for another wallet's DID | 403 | 403 | PASS |
| N1 | security | 10,000 nonces: no duplicates | 0 | 0 | PASS |
| N2 | security | every nonce is 32 bytes (64 hex chars) | 0 malformed | 0 | PASS |
| N3 | security | bit balance of nonces within 49-51% (sanity check, NOT a randomness proof) | 0.49-0.51 | 0.4997 | PASS |

## End-to-end lifecycle (backend + IPFS + chain)

### Measurements

| Metric | Unit | n | Mean | Median | P95 | Min | Max | Std dev |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| did.1_encryptAndPin | ms | 10 | 69.86 | 11.89 | 590.92 | 11.41 | 590.92 | 183.08 |
| did.2_registerOnChain | ms | 10 | 6.29 | 5.68 | 10.58 | 4.75 | 10.58 | 1.60 |
| did.2_registerOnChain.gas | gas | 10 | 251,129 | 251,129 | 251,129 | 251,129 | 251,129 | 0.00 |
| did.3_resolveOnChain | ms | 10 | 0.96 | 0.74 | 2.72 | 0.55 | 2.72 | 0.64 |
| did.4_fetchAndDecrypt | ms | 10 | 1.76 | 1.61 | 2.41 | 1.41 | 2.41 | 0.31 |
| did.TOTAL_registerToResolve | ms | 10 | 78.90 | 20.32 | 600.90 | 19.48 | 600.90 | 183.42 |
| vc.1_buildAndHash | ms | 10 | 0.18 | 0.04 | 1.32 | 0.04 | 1.32 | 0.40 |
| vc.2_issuerSignsHash | ms | 10 | 0.20 | 0.16 | 0.43 | 0.15 | 0.43 | 0.09 |
| vc.3_encryptAndPinSigned | ms | 10 | 11.30 | 11.36 | 12.36 | 10.34 | 12.36 | 0.60 |
| vc.4_registerHashOnChain | ms | 10 | 1.47 | 1.43 | 1.65 | 1.35 | 1.65 | 0.09 |
| vc.4_registerHashOnChain.gas | gas | 10 | 78,309 | 78,309 | 78,309 | 78,309 | 78,309 | 0.00 |
| vc.5_fetchAndDecrypt | ms | 10 | 1.37 | 1.40 | 1.44 | 1.23 | 1.44 | 0.08 |
| vc.6_verifyProofAndChain(valid) | ms | 10 | 4.59 | 2.53 | 21.45 | 2.38 | 21.45 | 5.94 |
| vc.7_revokeOnChain | ms | 10 | 1.14 | 1.05 | 1.78 | 0.94 | 1.78 | 0.25 |
| vc.7_revokeOnChain.gas | gas | 10 | 51,348 | 51,348 | 51,348 | 51,348 | 51,348 | 0.00 |
| vc.8_verifyOnChain(revoked) | ms | 10 | 0.43 | 0.40 | 0.54 | 0.37 | 0.54 | 0.05 |
| vc.TOTAL_issueVerifyRevoke | ms | 10 | 22.96 | 20.62 | 43.29 | 19.55 | 43.29 | 7.21 |

| Item | Value | Unit |
|---|---|---|
| vc.hasProofField | true |  |
| limitation.credentialCidOffChainOnly | Credential IPFS CIDs are indexed in MongoDB only, not on chain (only DID CIDs are on chain). The 'on chain CID matches IPFS document' check (E1/E2) therefore applies to DID documents; credentials are anchored by hash and verified by signature + hash. |  |
| limitation.serverHeldKey | A single backend-held AES key protects off-chain data; the backend is a trusted component for confidentiality (not for credential validity). |  |

### Checks

**Checks: 11/11 passed**

| ID | Category | Check | Expected | Actual | Result |
|---|---|---|---|---|---|
| E1 | integration | CID stored on chain matches the CID returned by IPFS (10x) | 10/10 | 10/10 | PASS |
| E2 | integration | DID document retrieved from IPFS matches the original after decryption (10x) | 10/10 | 10/10 | PASS |
| E3 | integration | signed credential can be retrieved and verified (10x) | 10/10 | 10/10 | PASS |
| E4 | integration | credential is valid before revocation and revoked afterwards (10x) | 10/10 | 10/10 | PASS |
| E5 | integration | credential hash stays the same after copying and signing (20x) | 20/20 | 20/20 | PASS |
| E5b | security | credential signature matches the issuer's address (10x) | 10/10 | 10/10 | PASS |
| E5c | security | edited credential is rejected when using the original signature (10x) | 10/10 | 10/10 | PASS |
| E6 | integration | same credential data produces the same hash regardless of key order | equal | equal | PASS |
| E7 | security | changing a credential claim produces a different hash that is not registered on chain | not issued | not issued | PASS |
| E7b | security | credential signed by someone other than the issuer is rejected | proofValid=false | proofValid=false | PASS |
| E7c | security | credential without an on chain registration is rejected | issued=false | issued=false | PASS |

