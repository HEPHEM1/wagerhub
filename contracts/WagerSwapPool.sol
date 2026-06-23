// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WagerSwapPool is Ownable {
    IERC20 public wagerToken;
    uint256 public hbarToWagerRate = 10; // 1 HBAR = 10 WAGER

    event Swap(address indexed user, uint256 hbarIn, uint256 wagerOut);

    constructor(address _wagerToken) Ownable(msg.sender) {
        wagerToken = IERC20(_wagerToken);
    }

    // Allows users to send HBAR and receive $WAGER back instantly
    function swapHbarForWager() external payable {
        require(msg.value > 0, "Must send HBAR");
        uint256 wagerAmount = msg.value * hbarToWagerRate;
        require(wagerToken.balanceOf(address(this)) >= wagerAmount, "Insufficient liquidity");

        wagerToken.transfer(msg.sender, wagerAmount);
        emit Swap(msg.sender, msg.value, wagerAmount);
    }

    // Owner can withdraw collected HBAR
    function withdrawHbar() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Owner can withdraw WAGER liquidity
    function withdrawWager(uint256 amount) external onlyOwner {
        wagerToken.transfer(owner(), amount);
    }
}
