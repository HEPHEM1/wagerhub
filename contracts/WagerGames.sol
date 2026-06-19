// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WagerGames is Ownable {
    IERC20 public wagerToken;
    
    event GamePlayed(address indexed player, string game, uint256 betAmount, uint256 payout, bool won);

    constructor(address _wagerToken) Ownable(msg.sender) {
        wagerToken = IERC20(_wagerToken);
    }

    // --- Helper to execute game logic ---
    function _executeGame(uint256 betAmount, string memory gameName, uint256 winMultiplier, uint256 winProbability) internal {
        require(wagerToken.balanceOf(msg.sender) >= betAmount, "Insufficient wager balance");
        require(wagerToken.balanceOf(address(this)) >= (betAmount * winMultiplier) / 100, "Insufficient treasury liquidity");

        // Player pays the bet
        bool transferSuccess = wagerToken.transferFrom(msg.sender, address(this), betAmount);
        require(transferSuccess, "Bet transfer failed");

        // Pseudo-random logic (For demonstration purposes only!)
        // winProbability is out of 100 (e.g. 50 = 50% chance to win)
        uint256 randomValue = block.timestamp % 100;
        bool won = randomValue < winProbability;
        
        uint256 payout = 0;
        if (won) {
            payout = (betAmount * winMultiplier) / 100;
            wagerToken.transfer(msg.sender, payout);
        }

        emit GamePlayed(msg.sender, gameName, betAmount, payout, won);
    }

    function playPenalty(uint256 betAmount) external {
        _executeGame(betAmount, "Penalty", 200, 50); // 2x multiplier, 50% chance
    }

    function playMysteryField(uint256 betAmount) external {
        _executeGame(betAmount, "MysteryField", 300, 33); // 3x multiplier, 33% chance
    }

    function playRPSZeroTrust(uint256 betAmount) external {
        _executeGame(betAmount, "RPSZeroTrust", 195, 50); // 1.95x multiplier, 50% chance
    }

    function playGravityDrop(uint256 betAmount) external {
        _executeGame(betAmount, "GravityDrop", 150, 66); // 1.5x avg multiplier, 66% chance
    }

    function playTrendRider(uint256 betAmount) external {
        _executeGame(betAmount, "TrendRider", 250, 40); // 2.5x multiplier, 40% chance
    }

    function playBlindLoot(uint256 betAmount) external {
        _executeGame(betAmount, "BlindLoot", 500, 20); // 5x multiplier, 20% chance
    }

    // Owner can withdraw WAGER liquidity
    function withdrawLiquidity(uint256 amount) external onlyOwner {
        wagerToken.transfer(owner(), amount);
    }
}
