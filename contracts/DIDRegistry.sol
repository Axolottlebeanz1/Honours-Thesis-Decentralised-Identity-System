// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDIDRegistry.sol";

// @title DIDRegistry
// @notice Links each Ethereum wallet address to a single DID record.
// @dev The full DID Document is encrypted with AES-256-GCM and stored on
//      IPFS. Only its CID, the DID string, the owner's address and the
//      registration or update time are stored on-chain.
contract DIDRegistry is IDIDRegistry {
    mapping(address => DIDRecord) private _records;
    mapping(address => bool) private _exists;

    modifier onlyRegistered() {
        require(_exists[msg.sender], "DIDRegistry: caller has no registered DID");
        _;
    }

    // @notice Creates a DID for the caller's wallet address. Each address can only register one DID.
    function registerDID(string calldata did, string calldata docCID) external override {
        require(!_exists[msg.sender], "DIDRegistry: address already has a registered DID");
        require(bytes(did).length > 0, "DIDRegistry: empty DID");
        require(bytes(docCID).length > 0, "DIDRegistry: empty docCID");

        _records[msg.sender] = DIDRecord({
            did: did,
            docCID: docCID,
            owner: msg.sender,
            timestamp: block.timestamp,
            active: true
        });
        _exists[msg.sender] = true;

        emit DIDRegistered(msg.sender, did, docCID, block.timestamp);
    }

    // @notice Updates the CID to point to a new encrypted version of the caller's DID Document.
    function updateDID(string calldata newDocCID) external override onlyRegistered {
        require(_records[msg.sender].active, "DIDRegistry: DID deactivated");
        require(bytes(newDocCID).length > 0, "DIDRegistry: empty docCID");

        _records[msg.sender].docCID = newDocCID;
        _records[msg.sender].timestamp = block.timestamp;

        emit DIDUpdated(msg.sender, newDocCID, block.timestamp);
    }

    // @notice Deactivates the caller's DID. Only its owner can do this.
    function deactivateDID() external override onlyRegistered {
        _records[msg.sender].active = false;
        _records[msg.sender].timestamp = block.timestamp;
        emit DIDDeactivated(msg.sender, block.timestamp);
    }

    // @notice Returns the DID record linked to the given wallet address.
    function resolveDID(address owner) external view override returns (DIDRecord memory) {
        require(_exists[owner], "DIDRegistry: no DID registered for this address");
        return _records[owner];
    }

    // @notice Checks whether the given address has an active DID.
    //         CredentialRegistry uses this before allowing an address to register or revoke a credential.
    function hasActiveDID(address owner) external view override returns (bool) {
        return _exists[owner] && _records[owner].active;
    }
}
