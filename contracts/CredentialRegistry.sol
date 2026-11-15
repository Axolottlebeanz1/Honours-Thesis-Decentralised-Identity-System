// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ICredentialRegistry.sol";
import "./interfaces/IDIDRegistry.sol";

// @title CredentialRegistry
// @notice Stores the hash of each Verifiable Credential along with its
//         issuer and revocation status. The actual credential data, including
//         its claims and subject details, stays off chain in the signed VC
//         JSON. The blockchain is only used to check whether a credential
//         has been revoked, keeping its contents off the public ledger.
contract CredentialRegistry is ICredentialRegistry {
    IDIDRegistry public immutable didRegistry;

    mapping(bytes32 => CredentialRecord) private _credentials;

    constructor(address didRegistryAddress) {
        require(didRegistryAddress != address(0), "CredentialRegistry: zero address");
        didRegistry = IDIDRegistry(didRegistryAddress);
    }

    modifier onlyRegisteredIssuer() {
        require(didRegistry.hasActiveDID(msg.sender), "CredentialRegistry: caller has no active DID");
        _;
    }

    // @notice Records a credential hash on chain and sets the caller as its
    //         issuer. The caller must have an active DID in DIDRegistry.
    function registerCredential(bytes32 credentialHash) external override onlyRegisteredIssuer {
        require(!_credentials[credentialHash].issued, "CredentialRegistry: credential already registered");

        _credentials[credentialHash] = CredentialRecord({
            issuer: msg.sender,
            issued: true,
            revoked: false,
            issuedAt: block.timestamp,
            revokedAt: 0
        });

        emit CredentialRegistered(credentialHash, msg.sender, block.timestamp);
    }

    // @notice Marks a registered credential as revoked. Only the address
    //         that originally issued the credential can revoke it.
    function revokeCredential(bytes32 credentialHash) external override {
        CredentialRecord storage record = _credentials[credentialHash];
        require(record.issued, "CredentialRegistry: credential not registered");
        require(record.issuer == msg.sender, "CredentialRegistry: caller is not the issuer");
        require(!record.revoked, "CredentialRegistry: already revoked");

        record.revoked = true;
        record.revokedAt = block.timestamp;

        emit CredentialRevoked(credentialHash, msg.sender, block.timestamp);
    }

    // @notice Checks whether a credential hash has been revoked. Returns
    //         false if the credential is still valid or has never been
    //         registered. Use getRecord() to tell these cases apart.
    function isRevoked(bytes32 credentialHash) external view override returns (bool) {
        return _credentials[credentialHash].revoked;
    }

    function getRecord(bytes32 credentialHash) external view override returns (CredentialRecord memory) {
        return _credentials[credentialHash];
    }
}
