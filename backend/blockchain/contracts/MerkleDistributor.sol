// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * MerkleDistributor — Phase 8 TGE / airdrop claims.
 * Standard OpenZeppelin-style Merkle claim against a single root.
 */
contract MerkleDistributor {
    bytes32 public immutable merkleRoot;
    address public immutable token;
    address public owner;

    mapping(uint256 => uint256) private claimedBitMap;

    event Claimed(uint256 indexed index, address indexed account, uint256 amount);

    constructor(address tokenAddress, bytes32 root) {
        require(tokenAddress != address(0), "MerkleDistributor: zero token");
        token = tokenAddress;
        merkleRoot = root;
        owner = msg.sender;
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        uint256 word = claimedBitMap[wordIndex];
        uint256 mask = (uint256(1) << bitIndex);
        return word & mask == mask;
    }

    function _setClaimed(uint256 index) private {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        claimedBitMap[wordIndex] = claimedBitMap[wordIndex] | (uint256(1) << bitIndex);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata proof) external {
        require(!isClaimed(index), "MerkleDistributor: already claimed");
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(_verify(proof, merkleRoot, node), "MerkleDistributor: invalid proof");
        _setClaimed(index);
        (bool ok, ) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", account, amount)
        );
        require(ok, "MerkleDistributor: transfer failed");
        emit Claimed(index, account, amount);
    }

    function _verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            if (computed <= p) {
                computed = keccak256(abi.encodePacked(computed, p));
            } else {
                computed = keccak256(abi.encodePacked(p, computed));
            }
        }
        return computed == root;
    }
}
