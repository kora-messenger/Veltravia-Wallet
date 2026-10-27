// SPDX-License-Identifier: MIT
/**
 * Veltravia Wallet Token (VWT)
 *
 * Clean, fixed-supply ERC-20. No owner functions after deployment: the entire
 * supply is minted once to the deployer at construction, then the contract is
 * immutable — no mint, no pause, no blacklist. Matches Veltravia's
 * privacy-first, self-custodial ethos: nobody can change the rules later.
 *
 * Deploy on any EVM chain (Ethereum, BSC, Base, Polygon...). 18 decimals,
 * standard everywhere.
 */
pragma solidity ^0.8.24;

contract VeltraviaWalletToken {
    string public constant name = "Veltravia Wallet Token";
    string public constant symbol = "VWT";
    uint8 public constant decimals = 18;

    // Total supply: 1,000,000,000 VWT (1 billion). Change BEFORE deploying —
    // this is the one number that can never be edited afterwards.
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    address public immutable deployer;

    constructor() {
        deployer = msg.sender;
        totalSupply = TOTAL_SUPPLY;
        balanceOf[msg.sender] = TOTAL_SUPPLY;
        emit Transfer(address(0), msg.sender, TOTAL_SUPPLY);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "VWT: allowance exceeded");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "VWT: zero address");
        uint256 bal = balanceOf[from];
        require(bal >= value, "VWT: balance too low");
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}
