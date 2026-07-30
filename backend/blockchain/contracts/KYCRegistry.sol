// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * KYCRegistry — on-chain attestation only (Phase 5A).
 * Stores status + record hash keyed by pseudonymous subjectId.
 * Never stores PII. Target chain: Polygon Amoy testnet / Polygon PoS.
 */
contract KYCRegistry {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    enum Status {
        Pending,
        Verified,
        Rejected,
        Revoked
    }

    struct Attestation {
        Status status;
        bytes32 recordHash;
        uint256 verifiedAt;
        address verifier;
    }

    mapping(bytes32 => Attestation) public attestations;
    mapping(bytes32 => mapping(address => bool)) private roles;
    mapping(bytes32 => address) private roleAdmin;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event Attested(bytes32 indexed subjectId, Status status, bytes32 recordHash, address verifier);
    event Revoked(bytes32 indexed subjectId, address verifier);

    constructor(address admin, address verifier) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, verifier);
        roleAdmin[VERIFIER_ROLE] = admin;
    }

    modifier onlyRole(bytes32 role) {
        require(roles[role][msg.sender], "KYCRegistry: missing role");
        _;
    }

    function _grantRole(bytes32 role, address account) internal {
        roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function attest(bytes32 subjectId, bytes32 recordHash, uint8 status)
        external
        onlyRole(VERIFIER_ROLE)
    {
        require(status <= uint8(Status.Revoked), "KYCRegistry: bad status");
        Status s = Status(status);
        attestations[subjectId] = Attestation({
            status: s,
            recordHash: recordHash,
            verifiedAt: block.timestamp,
            verifier: msg.sender
        });
        emit Attested(subjectId, s, recordHash, msg.sender);
    }

    function revoke(bytes32 subjectId) external onlyRole(VERIFIER_ROLE) {
        Attestation storage a = attestations[subjectId];
        a.status = Status.Revoked;
        a.verifiedAt = block.timestamp;
        a.verifier = msg.sender;
        emit Revoked(subjectId, msg.sender);
    }

    function getAttestation(bytes32 subjectId)
        external
        view
        returns (Status status, bytes32 recordHash, uint256 verifiedAt, address verifier)
    {
        Attestation memory a = attestations[subjectId];
        return (a.status, a.recordHash, a.verifiedAt, a.verifier);
    }
}
