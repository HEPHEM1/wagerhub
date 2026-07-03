// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HybridWagerSwapRouter (No-Oracle Edition)
 * @notice Swaps HBAR <-> USDC/USDT via a fixed owner-settable price,
 *         and HBAR <-> WAGER via constant-product AMM.
 *         Pyth oracle removed — eliminates PriceFeedNotFoundWithinRange on Hedera Testnet.
 */
contract HybridWagerSwapRouter is Ownable, ReentrancyGuard {
    IERC20 public wagerToken;
    IERC20 public usdcToken;
    IERC20 public usdtToken;

    // -----------------------------------------------------------------
    // Fixed price: how many USDC micro-units (6 decimals) equal 1 HBAR.
    // e.g. if HBAR = $0.07172, set to 71720
    // Owner can call setHbarUsdPrice() any time to update it.
    // -----------------------------------------------------------------
    uint256 public hbarUsdPrice; // USDC per HBAR, scaled to 1e6

    event SwapHbarForToken(address indexed user, string tokenOut, uint256 hbarIn, uint256 tokenOut_amount);
    event SwapTokenForHbar(address indexed user, string tokenIn,  uint256 tokenIn_amount, uint256 hbarOut);
    event SwapTokenForToken(address indexed user, string tokenIn, string tokenOut, uint256 amountIn, uint256 amountOut);
    event HbarUsdPriceUpdated(uint256 oldPrice, uint256 newPrice);

    constructor(
        address _wagerToken,
        address _usdcToken,
        address _usdtToken,
        uint256 _initialHbarUsdPrice   // e.g. 71720 for $0.07172
    ) Ownable(msg.sender) {
        wagerToken    = IERC20(_wagerToken);
        usdcToken     = IERC20(_usdcToken);
        usdtToken     = IERC20(_usdtToken);
        hbarUsdPrice  = _initialHbarUsdPrice;
    }

    // ── Owner: update the HBAR/USD reference price ────────────────────
    function setHbarUsdPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be > 0");
        emit HbarUsdPriceUpdated(hbarUsdPrice, newPrice);
        hbarUsdPrice = newPrice;
    }

    // ── Internal: resolve symbol → token interface ────────────────────
    function _getToken(string memory symbol) internal view returns (IERC20) {
        bytes32 h = keccak256(bytes(symbol));
        if (h == keccak256(bytes("$WAGER")) || h == keccak256(bytes("WAGER"))) return wagerToken;
        if (h == keccak256(bytes("USDC")))  return usdcToken;
        if (h == keccak256(bytes("USDT")))  return usdtToken;
        revert("Unsupported token");
    }

    // ── Oracle-style swaps using fixed price ──────────────────────────

    // HBAR (msg.value wei) → Stablecoin
    // amountOut = (hbarWei * hbarUsdPrice) / 1e18   [result is in 6-decimal stable units]
    function _swapHbarForStable(
        IERC20 token,
        string memory tokenSymbol,
        uint256 hbarWei,
        uint256 minAmountOut
    ) internal returns (uint256) {
        uint256 amountOut = (hbarWei * hbarUsdPrice) / 1e18;
        require(amountOut >= minAmountOut, "Slippage too high");
        require(token.balanceOf(address(this)) >= amountOut, "Insufficient treasury stablecoin liquidity");
        token.transfer(msg.sender, amountOut);
        emit SwapHbarForToken(msg.sender, tokenSymbol, hbarWei, amountOut);
        return amountOut;
    }

    // Stablecoin → HBAR
    // hbarOut = (stableAmount * 1e18) / hbarUsdPrice
    function _swapStableForHbar(
        IERC20 token,
        string memory tokenSymbol,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        uint256 hbarOut = (amountIn * 1e18) / hbarUsdPrice;
        require(hbarOut >= minAmountOut, "Slippage too high");
        require(address(this).balance >= hbarOut, "Insufficient treasury HBAR liquidity");
        require(token.transferFrom(msg.sender, address(this), amountIn), "Stablecoin transfer failed");
        (bool ok, ) = msg.sender.call{value: hbarOut}("");
        require(ok, "HBAR transfer failed");
        emit SwapTokenForHbar(msg.sender, tokenSymbol, amountIn, hbarOut);
        return hbarOut;
    }

    // ── AMM swaps (HBAR ↔ WAGER) ──────────────────────────────────────

    function _ammSwapHbarForWager(uint256 msgValue, uint256 minAmountOut) internal returns (uint256) {
        uint256 reserveIn  = address(this).balance - msgValue;
        uint256 reserveOut = wagerToken.balanceOf(address(this));
        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");
        uint256 amountOut = (reserveOut * msgValue) / (reserveIn + msgValue);
        require(amountOut >= minAmountOut, "Slippage too high");
        wagerToken.transfer(msg.sender, amountOut);
        emit SwapHbarForToken(msg.sender, "WAGER", msgValue, amountOut);
        return amountOut;
    }

    function _ammSwapWagerForHbar(uint256 amountIn, uint256 minAmountOut) internal returns (uint256) {
        uint256 reserveIn  = wagerToken.balanceOf(address(this));
        uint256 reserveOut = address(this).balance;
        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");
        uint256 amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
        require(amountOut >= minAmountOut, "Slippage too high");
        require(wagerToken.transferFrom(msg.sender, address(this), amountIn), "WAGER transfer failed");
        (bool ok, ) = msg.sender.call{value: amountOut}("");
        require(ok, "HBAR transfer failed");
        emit SwapTokenForHbar(msg.sender, "WAGER", amountIn, amountOut);
        return amountOut;
    }

    // ── Public entry points ───────────────────────────────────────────

    /// @notice Swap HBAR for a token. All msg.value is treated as the swap amount.
    function swapHbarForToken(
        string calldata tokenOutSymbol,
        uint256 minAmountOut
    ) external payable nonReentrant {
        require(msg.value > 0, "Must send HBAR");
        IERC20 tokenOut = _getToken(tokenOutSymbol);
        if (tokenOut == usdcToken || tokenOut == usdtToken) {
            _swapHbarForStable(tokenOut, tokenOutSymbol, msg.value, minAmountOut);
        } else if (tokenOut == wagerToken) {
            _ammSwapHbarForWager(msg.value, minAmountOut);
        } else {
            revert("Unsupported swap path");
        }
    }

    /// @notice Swap a token for HBAR.
    function swapTokenForHbar(
        string calldata tokenInSymbol,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable nonReentrant {
        require(msg.value == 0, "Do not send HBAR for token->HBAR swaps");
        IERC20 tokenIn = _getToken(tokenInSymbol);
        if (tokenIn == usdcToken || tokenIn == usdtToken) {
            _swapStableForHbar(tokenIn, tokenInSymbol, amountIn, minAmountOut);
        } else if (tokenIn == wagerToken) {
            _ammSwapWagerForHbar(amountIn, minAmountOut);
        } else {
            revert("Unsupported swap path");
        }
    }

    /// @notice Stable ↔ Stable swap (1:1). WAGER↔Stable explicitly blocked.
    function swapTokenForToken(
        string calldata tokenInSymbol,
        string calldata tokenOutSymbol,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant {
        IERC20 tokenIn  = _getToken(tokenInSymbol);
        IERC20 tokenOut = _getToken(tokenOutSymbol);
        if ((tokenIn == usdcToken || tokenIn == usdtToken) &&
            (tokenOut == usdcToken || tokenOut == usdtToken)) {
            require(tokenOut.balanceOf(address(this)) >= amountIn, "Insufficient treasury liquidity");
            require(amountIn >= minAmountOut, "Slippage too high");
            require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "Transfer failed");
            require(tokenOut.transfer(msg.sender, amountIn), "Transfer failed");
            emit SwapTokenForToken(msg.sender, tokenInSymbol, tokenOutSymbol, amountIn, amountIn);
        } else {
            revert("BLOCKED ROUTE: Stable<->WAGER not allowed");
        }
    }

    /// @notice Owner withdraws liquidity or fees.
    function withdrawLiquidity(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(0)) {
            (bool ok, ) = owner().call{value: amount}("");
            require(ok, "HBAR transfer failed");
        } else {
            IERC20(tokenAddress).transfer(owner(), amount);
        }
    }

    receive() external payable {}
}
