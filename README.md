# Decentralised Identity System

This project is a prototype of a decentralised identity system using Decentralised Identifiers (DIDs) and Verifiable Credentials (VCs) for my thesis 2026. It uses Ethereum smart contracts written in Solidity to register and manage DID records and credential hashes. The actual DID documents and credential data are encrypted using AES-256-GCM and stored off-chain on IPFS, while their corresponding references or hashes are recorded on the blockchain.

The backend is built with Node.js and Express and handles the API requests, authentication, encryption and communication with the blockchain and IPFS. The frontend uses React to provide an interface where users can connect their wallets and interact with the identity system.

## Stack
- **Smart Contracts**: Solidity 0.8.20, Hardhat
- **Backend**: Node.js, Express, MongoDB (Mongoose), ethers.js
- **Frontend**: React 18, Vite, react-router, ethers.js
- **Storage**: IPFS (via `ipfs-http-client`) for encrypted DID Documents and VC data

## Quick start

```bash
# 0. Start IPFS using a local Kudo instance in Git Bash
cd Kubo location
ipfs init
ipfs daemon

# 1. Install everything
npm install
npm --prefix backend install
npm --prefix frontend install

# 2. Start a local Hardhat network.
    # Keep this terminal running while working with the application. 
npm run node                      

# 3. Deploy the smart contracts
    # Open a new terminal and run the command to deploy both smart contracts and display their addresses. 
npm run deploy:local       

# 4. Copy the example environment files
    # Update the environment files with the required contract addresses in Step 3.
    # The backend configuration also needs a working MongoDB connection URI and an encryption key.  
cp backend/.env.example backend/.env        
cp frontend/.env.example frontend/.env 

# Generate a new encryption key for backend/.env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 5. Start the backend, which is available at http://localhost:4000.
npm run backend

# 6. In another terminal, start the frontend, which is available at http://localhost:5173. 
npm run frontend                  
```
## Running the Tests

Run the smart contract tests with `npm test` in the project root directory. 

Run the backend authentication and reply-attack integration tests from the `backend/` directory and run `npm test`.

## Project structure and key files

The following sections describe the main folders and files in the project and explain what each one is responsible for.

### `contracts/`

This folder contains the Solidity smart contracts used to manage decentralised identities and credentials. 

| File | Purpose |
|---|---|
| `DIDRegistry.sol` | Handles DID registration and management. Each wallet address can have one DID, stored in a mapping(address => DIDRecord). The contract supports registering, updating and deactivating DIDs, as well as checking whether an address has an active DID and retrieving its record. |
| `CredentialRegistry.sol` | Keeps track of credential hashes, issuers and their issued or revoked status. The actual credential claims are not stored on chain. Registration requires the issuer to have an active DID, and only the issuer can revoke their credential. |
| `interfaces/*.sol` | Contains the contract interfaces used by the backend and deployment scripts. These provide a consistent way for other parts of the project to interact with the contracts. |

### `backend/`

The backend handles requests from the frontend and connects the application to MongoDB, Ethereum and IPFS. It also manages authentication, encryption and credential verification.

| File | Purpose |
|---|---|
| `app.js` | Sets up the Express application, including its routes and middleware. It is exported separately so it can be imported directly by the test files without starting the server. |
| `server.js` | Starts the backend. It connects to MongoDB before starting the Express server. |
| `config/index.js`, `config/db.js` | Handle environment settings, including the encryption key, and the MongoDB connection. |
| `routes/*.routes.js` | Defines the API endpoints used for authentication, DID management and credential operations. |
| `controllers/*.controller.js` | Handles incoming API requests and coordinates the main operations. For example, DID registration involves encrypting and uploading the document before confirming its on chain registration. |
| `services/nonce.service.js` | Generates random 32-byte login nonces using `crypto.randomBytes(32)`. Each nonce is stored temporarily and can only be used once, helping prevent replay attacks. |
| `services/signature.service.js` | Creates the authentication challenge message and checks wallet signatures using `ethers.verifyMessage`. |
| `services/ipfs.service.js` | Encrypts JSON data using AES-256-GCM before uploading it to IPFS. Each document gets a randomly generated IV and an authentication tag. It also handles retrieving and decrypting stored data. `pinEncryptedJSON()` is used when uploading documents, while `fetchDecryptedJSON()` is used when retrieving them. |
| `services/credential.service.js` | Builds the W3C Verifiable Credential JSON structure and calculates its keccak256 hash without including the proof field. It then attaches the issuer's wallet signature as proof and provides functions to verify credential signatures. |
| `services/blockchain.service.js` | Provides a wrapper around ethers.js for interacting with the smart contracts. It handles operations such as resolving DIDs, checking active DID status, checking credential revocation and retrieving credential records. |
| `storage/cache.service.js` | Provides a temporary in-memory cache for blockchain read operations, reducing repeated requests to the network. |
| `middleware/auth.middleware.js` | Protects restricted API endpoints by checking the JWT session token. |
| `middleware/error.middleware.js` | Handles missing routes and application errors, returning consistent JSON error responses. |
| `models/*.model.js` | Contains the Mongoose schemas used to mirror on chain information in MongoDB. This makes it easier to list and search for records without repeatedly querying the blockchain. |
| `utils/validators.js`, `utils/logger.js` | Handle request validation and application logging. |
| `utils/encryption.js` | Contains the AES-256-GCM encryption and decryption functions used by the IPFS service. Each operation uses a random 96-bit IV and a 128-bit authentication tag. If encrypted data has been modified, decryption fails. |
| `test/auth.integration.test.js` | Tests the authentication process, including nonce generation, successful wallet login, replay-attack rejection, forged-signature rejection and access control for protected endpoints. |
| `test/encryption.test.js`, `test/credential.service.test.js` | Test encryption and tamper detection, as well as credential hashing, proof signing, signature verification and rejection of forged credentials. |

### `frontend/src/`

This folder contains the React application that users interact with. It provides the interface for connecting wallets, creating DIDs, issuing credentials and verifying credentials.

| File | Purpose |
|---|---|
| `App.jsx` | Defines the application routes and uses `ProtectedRoute` to restrict access to pages that require authentication. |
| `main.jsx` | Starts the React application and wraps it with `BrowserRouter` and `Web3Provider` so routing and wallet information are available throughout the application. |
| `context/Web3Context.jsx` | Manages the connected wallet information, including the account address, blockchain network and provider. |
| `hooks/useWallet.js`, `hooks/useContract.js` | Provide access to wallet information and create smart contract instances linked to the connected wallet. |
| `services/api.js` | Handles requests from the frontend to the backend REST API. |
| `services/contractService.js` | Contains the functions used to interact with the smart contracts, including DID registration, DID updates, credential registration and credential revocation. Transactions are signed using the connected wallet. |
| `utils/did.js`, `utils/format.js` | Provides helper functions for building did:ethr identifiers and formatting wallet addresses and dates. |
| `pages/Home.jsx` | Displays the landing page and introduces the main three-step process of the system. |
| `pages/CreateDID.jsx` | Handles DID creation. The document is encrypted and uploaded to IPFS before the user signs the blockchain transaction to register the DID. |
| `pages/IssueCredential.jsx` | Allows an issuer to create a credential, sign its hash using their wallet, encrypt and upload the signed credential to IPFS, and register its hash on the blockchain. |
| `pages/VerifyCredential.jsx` | Allows a relying party to check a credential presented by its holder. The backend verifies the issuer's signature, on chain registration, issuer details, revocation status and expiry date. A separate hash-only status check is also available. |
| `pages/Dashboard.jsx` | Displays the connected wallet's DID and received credentials. |
| `components/Navbar.jsx`, `WalletConnectButton.jsx` | Provide the main navigation bar and wallet connection button. |
| `components/DIDCard.jsx`, `CredentialCard.jsx` | Display DID and credential information using the application's card design. The DID card also includes a "View document" option, which retrieves and decrypts the DID document from IPFS for logged in users. |
| `components/ProtectedRoute.jsx` | Checks whether a wallet is connected before allowing access to protected pages. If no wallet is connected, the user is redirected to the home page. |
| `contracts/*.json` | Contains the smart contract ABIs used by the frontend. These are generated again whenever `scripts/deploy.js` is run. |
| `index.css` | Contains the application's design variables and styling for its pages and components. The seal-style design is used throughout the interface. More information about the design and system trust model is available in `docs/architecture.md.` |

### Root Directory and Supporting Files

The project root contains the configuration, deployment scripts, tests and documentation needed to run and maintain the application.

| File | Purpose |
|---|---|
| `hardhat.config.js` | Configures the Solidity compiler and Hardhat networks, including the local development network. It also includes the gas reporter configuration. |
| `scripts/deploy.js` | Deploys both smart contracts and copies their ABIs into `frontend/src/contracts` so the frontend can interact with them. |
| `scripts/seed.js` | Adds two example DIDs to the local blockchain, registers a sample credential hash and then revokes one of the example credentials. |
| `test/*.test.js` | Contains the smart contract tests, covering DID registration, duplicate registration prevention, access control, and credential registration and revocation. |

## Troubleshooting

### Nonce error: "Nonce too high. Expected nonce to be 0 but got N"

This error can occur when sending a transaction after restarting the local Hardhat network.

The local Hardhat blockchain runs in memory, so restarting it resets account nonces back to zero. However, MetaMask may still remember the previous transaction count, causing a mismatch between the wallet and the local network.

**How to fix it:**

1. Open MetaMask.
2. Go to Settings → Advanced.
3. Select Clear activity tab data to reset the stored transaction activity.
4. Try sending the transaction again.

**Important:** Restarting the Hardhat node also removes the previously deployed contracts because the local blockchain state is reset. You will therefore need to run the deployment command again:

`npm run deploy:local`

Make sure to update the contract addresses in both environment files if the new deployment produces different addresses.
