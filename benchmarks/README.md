# Evaluation Harness

This folder contains the scripts used to test the prototype and collect results for the thesis evaluation. The scripts run a series of checks covering the smart contracts, wallet authentication, IPFS storage and the complete system workflow.

After running the tests, the results are saved in several formats:

- **JSON:** Contains the raw results from each test run.
- **CSV:** Provides summary metrics and individual test results for further analysis.
- **Markdown:** Generates a report with tables that can be used when writing the thesis evaluation chapter.

## Running the Tests

Before running the evaluation scripts, make sure IPFS is running and the project dependencies have been installed.

```bash
# Start IPFS (required for the IPFS and end to end tests)
docker compose up -d

# Install dependencies
npm install
npm --prefix backend install

# Run the complete evaluation
npm run bench
```

The main benchmark command runs all four test suites in sequence:

1. Smart contract tests (`chain`)
2. Authentication tests (`auth`)
3. IPFS storage tests (`ipfs`)
4. End to end tests (`e2e`)

Once all four suites have finished, a report is generated automatically.

You can also run each suite separately if you only need to test a particular part of the system:

```bash
npm run bench:chain
npm run bench:auth
npm run bench:ipfs
npm run bench:e2e
npm run bench:report
```

### Customising the Tests

The number of benchmark iterations can be changed using the `BENCH_N` environment variable. For example:

```bash
BENCH_N=50 npm run bench
```

You can also change the gas price and ETH exchange rate used when estimating transaction costs:

```bash
GAS_PRICE_GWEI=15 ETH_USD=3500 npm run bench:chain
```

These two values only affect the estimated USD transaction costs, not the actual gas consumption. When reporting these costs in the thesis, make sure to state the assumed gas price and ETH exchange rate.

### Where the Results Are Saved

All benchmark results are stored in:

```text
benchmarks/results/
```

Each test run produces a timestamped JSON file for its respective suite, followed by three summary files:

- `REPORT.md` – A report containing the main results and tables.
- `metrics.csv` – A summary of the measured performance metrics.
- `checks.csv` – The results of the individual functional and security checks.

The timestamped JSON files are kept so that results from earlier runs can still be reviewed and compared. It is a good idea to keep these files as supporting evidence for the thesis.

## Test Suites

The evaluation is divided into four suites. Each one focuses on a different part of the system and measures its performance, functionality or security behaviour.

| Test suite | Requirements | What it tests |
|---|---|---|
| `chain.js` | Hardhat | Measures gas consumption for individual smart contract functions, deployment gas, blockchain read and transaction times, and estimated transaction costs. It also runs 14 functional and access-control checks, along with a check to confirm that credential claims are not included in transaction calldata. |
| `auth.js` | Backend dependencies | Measures login performance, including the different stages of authentication, and tests concurrent login requests. It also checks how the system handles replayed, forged, stale and expired signatures, cross-address authentication attempts and JWT attacks. Additional checks cover endpoint access control, nonce uniqueness and basic entropy. |
| `ipfs.js` | Running IPFS and backend dependencies | Measures the time taken to encrypt, upload, retrieve and decrypt documents of different sizes. It also checks storage overhead, concurrent requests, data confidentiality, CID integrity and how the system handles modified encrypted data. |
| `e2e.js` | Hardhat and IPFS | Tests the complete DID and credential workflows across the backend, IPFS and blockchain. This includes checking that the CID recorded on-chain matches the document stored on IPFS, verifying signed credentials and confirming that forged claims, incorrect signers and unregistered credentials are rejected. It also checks that credential hashes are calculated consistently. |

## Metrics and Their Relevance to the Thesis

The evaluation collects several measurements and test results that relate directly to the research questions and project objectives.

| Metric | Test suite | Relevance to the thesis |
|---|---|---|
| Gas used for DID registration, updating and deactivation, and credential registration and revocation | Chain | RQ2 – Evaluates the gas efficiency of the smart contracts. |
| Smart contract deployment gas | Chain | RQ2 – Measures the initial cost of deploying the contracts. |
| Estimated transaction cost in USD | Chain | RQ2 – Provides an estimate of transaction costs and their potential impact on scalability. |
| Gas consumption for the first and last registered users | Chain | RQ2 – Examines whether registration costs change as more users are added, particularly with the use of mapping-based storage. |
| Gas consumption using CIDv0 and CIDv1 | Chain | RQ2 – Examines whether different CID lengths affect the cost of storing references on-chain. |
| Transaction and read latency | Chain | RQ2 – Measures blockchain interaction times under ideal local testing conditions. |
| Functional and access-control pass rate | Chain | RQ1 and Objective 2 – Checks whether the smart contracts behave as expected and enforce the required permissions. |
| Transaction calldata containing a 4-byte function selector and 32-byte hash | Chain | Privacy and data minimisation – Checks that credential claims are not directly included in the transaction data. |
| Nonce generation, wallet signing, signature verification and full login latency (mean and P95) | Auth | RQ3 and Objective 3 – Evaluates the performance of wallet-based authentication. |
| Number of successful logins per second | Auth | RQ2 – Examines the backend's ability to handle concurrent authentication requests. |
| Rejection of replay, forged, stale, expired, cross-address and JWT attacks | Auth | RQ3 – Evaluates the system's response to selected authentication attacks. |
| Nonce uniqueness and bit balance | Auth | RQ3 – Provides basic checks of nonce generation, but does not prove cryptographic randomness. |
| Encryption, upload, retrieval and decryption times for different document sizes | IPFS | RQ2 – Measures the performance and potential scalability of off-chain storage. |
| Encrypted data size compared with the original document size | IPFS | RQ2 – Measures the additional storage overhead introduced by encryption. |
| Original plaintext is absent from raw IPFS data, and decryption fails with an incorrect key | IPFS | Objective 4 – Checks data confidentiality. |
| CID recalculation and changes to the CID after modifying one byte of stored data | IPFS | Objective 4 – Checks content integrity and the ability to detect changes to stored data. |
| Different CIDs produced when the same document is encrypted more than once | IPFS | Privacy – Examines the effect of using a random IV on the resulting encrypted content and CID. |
| Detection of changes to ciphertext, IV and authentication tag, including 200 random bit-flip tests | IPFS | Objective 4 – Tests AES-256-GCM tamper detection. |
| Matching on-chain and IPFS CIDs, and successful recovery of the original DID document | end to end | Section 2.11 – Checks whether the different storage and blockchain components work together correctly. |
| Time taken at each stage of the DID and credential lifecycle | end to end | RQ1 and RQ2 – Measures the overall performance of the main system workflows. |
| Successful verification of signed credentials, and rejection of edited claims, incorrect signers and unregistered credentials | end to end | RQ1 – Evaluates whether the credential verification process works as intended. |
