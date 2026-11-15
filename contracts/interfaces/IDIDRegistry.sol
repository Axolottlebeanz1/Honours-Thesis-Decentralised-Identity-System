// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// @title IDIDRegistry
// @notice Stores one DID record for each Ethereum wallet address. Each record
//         contains the DID string, the IPFS CID of its document, the owner's
//         wallet address and the time it was last registered or updated.
interface IDIDRegistry {
    struct DIDRecord {
        string  did;        // DID string, e.g. "did:ethr:0xabc..."
        string  docCID;     // IPFS CID pointing to the encrypted DID Document
        address owner;      // Wallet address that owns the DID
        uint256 timestamp;  // Time of the last registration or update
        bool    active;
    }

    event DIDRegistered(address indexed owner, string did, string docCID, uint256 timestamp);
    event DIDUpdated(address indexed owner, string docCID, uint256 timestamp);
    event DIDDeactivated(address indexed owner, uint256 timestamp);

    function registerDID(string calldata did, string calldata docCID) external;
    function updateDID(string calldata newDocCID) external;
    function deactivateDID() external;
    function resolveDID(address owner) external view returns (DIDRecord memory);
    function hasActiveDID(address owner) external view returns (bool);
}
