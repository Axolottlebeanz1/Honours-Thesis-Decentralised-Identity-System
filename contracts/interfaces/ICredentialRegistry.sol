// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// @title ICredentialRegistry
// @notice Keeps track of credential hashes and their revocation status.
//         The actual Verifiable Credentials, including their issuer, subject
//         and claims, are signed and stored off chain. Only the credential
//         hash, issuer address and revocation status are recorded on chain.
//         This allows verifiers to check whether a credential has been
//         revoked without exposing its contents on the blockchain.
interface ICredentialRegistry {
    struct CredentialRecord {
        address issuer;
        bool    issued;
        bool    revoked;
        uint256 issuedAt;
        uint256 revokedAt;
    }

    event CredentialRegistered(bytes32 indexed credentialHash, address indexed issuer, uint256 timestamp);
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed issuer, uint256 timestamp);

    function registerCredential(bytes32 credentialHash) external;
    function revokeCredential(bytes32 credentialHash) external;
    function isRevoked(bytes32 credentialHash) external view returns (bool);
    function getRecord(bytes32 credentialHash) external view returns (CredentialRecord memory);
}
