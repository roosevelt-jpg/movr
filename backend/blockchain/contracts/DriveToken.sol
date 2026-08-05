// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DriveToken (DVT) — Phase 5B utility token.
 * Mint restricted to distributor. Target: Polygon Amoy / PoS.
 * Allocation constants are documented for vesting; minting remains distributor-gated.
 */
contract DriveToken {
    string public constant name = "DriveToken";
    string public constant symbol = "DVT";
    uint8 public constant decimals = 18;

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;
    // Allocation shares of MAX_SUPPLY (basis points): community 50%, treasury 20%, rest 30%
    uint256 public constant COMMUNITY_BPS = 5000;
    uint256 public constant TREASURY_BPS = 2000;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 public totalSupply;
    address public distributor;
    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event RewardDistributed(address indexed to, uint256 amount, bytes32 activityRef);
    event DistributorUpdated(address indexed previous, address indexed next);

    modifier onlyOwner() {
        require(msg.sender == owner, "DriveToken: not owner");
        _;
    }

    modifier onlyDistributor() {
        require(msg.sender == distributor, "DriveToken: not distributor");
        _;
    }

    constructor(address initialOwner, address initialDistributor) {
        require(initialOwner != address(0) && initialDistributor != address(0), "DriveToken: zero");
        owner = initialOwner;
        distributor = initialDistributor;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address tokenOwner, address spender) external view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        require(allowed >= amount, "DriveToken: allowance");
        unchecked {
            _allowances[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function setDistributor(address next) external onlyOwner {
        require(next != address(0), "DriveToken: zero");
        emit DistributorUpdated(distributor, next);
        distributor = next;
    }

    function distributeReward(address to, uint256 amount, bytes32 activityRef)
        external
        onlyDistributor
    {
        require(to != address(0), "DriveToken: zero to");
        require(totalSupply + amount <= MAX_SUPPLY, "DriveToken: cap");
        totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
        emit RewardDistributed(to, amount, activityRef);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "DriveToken: zero to");
        uint256 bal = _balances[from];
        require(bal >= amount, "DriveToken: balance");
        unchecked {
            _balances[from] = bal - amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
