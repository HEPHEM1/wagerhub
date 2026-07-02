// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract HybridWagerSwapRouter is Ownable, ReentrancyGuard {
    IERC20 public wagerToken;
    IERC20 public usdcToken;
    IERC20 public usdtToken;

    IPyth public pyth;
    bytes32 public hbarUsdPriceFeedId;

    event SwapHbarForToken(address indexed user, string tokenOut, uint256 amountIn, uint256 amountOut, bool isOracle);
    event SwapTokenForHbar(address indexed user, string tokenIn, uint256 amountIn, uint256 amountOut, bool isOracle);
    event SwapTokenForToken(address indexed user, string tokenIn, string tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(
        address _wagerToken,
        address _usdcToken,
        address _usdtToken,
        address _pythContract,
        bytes32 _hbarUsdPriceFeedId
    ) Ownable(msg.sender) {
        wagerToken = IERC20(_wagerToken);
        usdcToken = IERC20(_usdcToken);
        usdtToken = IERC20(_usdtToken);
        pyth = IPyth(_pythContract);
        hbarUsdPriceFeedId = _hbarUsdPriceFeedId;
    }

    // --- Pyth Config ---
    function setPyth(address _pythContract, bytes32 _priceFeedId) external onlyOwner {
        pyth = IPyth(_pythContract);
        hbarUsdPriceFeedId = _priceFeedId;
    }

    // Helper to get token interface and block Stables <-> WAGER swaps inherently.
    // Notice that WAGER -> Stables and Stables -> WAGER are blocked because `swapTokenForToken` requires both to be non-zero,
    // and we will enforce strict pair constraints in the swap functions themselves.
    function _getToken(string memory symbol) internal view returns (IERC20) {
        if (keccak256(bytes(symbol)) == keccak256(bytes("$WAGER")) || keccak256(bytes(symbol)) == keccak256(bytes("WAGER"))) return wagerToken;
        if (keccak256(bytes(symbol)) == keccak256(bytes("USDC"))) return usdcToken;
        if (keccak256(bytes(symbol)) == keccak256(bytes("USDT"))) return usdtToken;
        revert("Unsupported token");
    }

    // --- Math Helpers ---
    function _convertToAbsDecimals(int64 price, int32 expo, uint8 targetDecimals) internal pure returns (uint256) {
        require(price > 0, "Negative or zero price from Oracle");
        uint256 uPrice = uint256(uint64(price));
        
        if (expo < 0) {
            uint32 absExpo = uint32(-expo);
            if (targetDecimals >= absExpo) {
                return uPrice * (10 ** (targetDecimals - absExpo));
            } else {
                return uPrice / (10 ** (absExpo - targetDecimals));
            }
        } else {
            return uPrice * (10 ** (uint32(expo) + targetDecimals));
        }
    }

    // --- Oracle Swaps (HBAR <-> Stables) ---
    function _exactOracleSwapHbarForStable(
        IERC20 token, 
        string memory tokenSymbol, 
        uint256 msgValue, 
        uint256 minAmountOut, 
        bytes[] calldata priceUpdateData
    ) internal returns (uint256) {
        // Pay Pyth fee and update price
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msgValue > fee, "Insufficient HBAR for Pyth fee");
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        uint256 swapHbarAmount = msgValue - fee;

        // Fetch price (max age 60 seconds)
        PythStructs.Price memory price = pyth.getPriceNoOlderThan(hbarUsdPriceFeedId, 60);
        
        // Calculate amount out (Stables have 6 decimals, HBAR msg.value is 18 decimals)
        uint256 priceOfOneHbarInStables = _convertToAbsDecimals(price.price, price.expo, 6);
        uint256 amountOut = (swapHbarAmount * priceOfOneHbarInStables) / 1e18;

        require(amountOut >= minAmountOut, "Slippage too high");
        require(token.balanceOf(address(this)) >= amountOut, "Insufficient treasury stablecoin liquidity");

        // Transfer stablecoins to user
        token.transfer(msg.sender, amountOut);

        emit SwapHbarForToken(msg.sender, tokenSymbol, swapHbarAmount, amountOut, true);
        return amountOut;
    }

    function _exactOracleSwapStableForHbar(
        IERC20 token, 
        string memory tokenSymbol, 
        uint256 amountIn, 
        uint256 msgValue, 
        uint256 minAmountOut, 
        bytes[] calldata priceUpdateData
    ) internal returns (uint256) {
        // Pay Pyth fee
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msgValue >= fee, "Insufficient HBAR for Pyth fee");
        if (fee > 0) {
            pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        }

        // Fetch price (max age 60 seconds)
        PythStructs.Price memory price = pyth.getPriceNoOlderThan(hbarUsdPriceFeedId, 60);

        uint256 priceOfOneHbarInStables = _convertToAbsDecimals(price.price, price.expo, 6);
        uint256 amountOutHbar = (amountIn * 1e18) / priceOfOneHbarInStables;

        require(amountOutHbar >= minAmountOut, "Slippage too high");
        require(address(this).balance >= amountOutHbar, "Insufficient treasury HBAR liquidity");

        // Pull stablecoins from user
        require(token.transferFrom(msg.sender, address(this), amountIn), "Stablecoin transfer failed");

        // Send HBAR to user
        (bool success, ) = msg.sender.call{value: amountOutHbar}("");
        require(success, "HBAR transfer failed");

        // Refund excess HBAR sent for fee
        if (msgValue > fee) {
            (bool refundSuccess, ) = msg.sender.call{value: msgValue - fee}("");
            require(refundSuccess, "Fee refund failed");
        }

        emit SwapTokenForHbar(msg.sender, tokenSymbol, amountIn, amountOutHbar, true);
        return amountOutHbar;
    }


    // --- AMM Swaps (HBAR <-> WAGER ONLY) ---
    function _ammSwapHbarForWager(uint256 msgValue, uint256 minAmountOut) internal returns (uint256) {
        uint256 reserveIn = address(this).balance - msgValue; // HBAR reserve before swap
        uint256 reserveOut = wagerToken.balanceOf(address(this));
        
        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");

        // Constant product formula with 0% fee (for simplicity, or add fee if desired)
        uint256 amountOut = (reserveOut * msgValue) / (reserveIn + msgValue);
        
        require(amountOut >= minAmountOut, "Slippage too high");
        
        wagerToken.transfer(msg.sender, amountOut);
        
        emit SwapHbarForToken(msg.sender, "WAGER", msgValue, amountOut, false);
        return amountOut;
    }

    function _ammSwapWagerForHbar(uint256 amountIn, uint256 minAmountOut) internal returns (uint256) {
        uint256 reserveIn = wagerToken.balanceOf(address(this));
        uint256 reserveOut = address(this).balance;

        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");

        uint256 amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
        
        require(amountOut >= minAmountOut, "Slippage too high");

        require(wagerToken.transferFrom(msg.sender, address(this), amountIn), "WAGER transfer failed");

        (bool success, ) = msg.sender.call{value: amountOut}("");
        require(success, "HBAR transfer failed");

        emit SwapTokenForHbar(msg.sender, "WAGER", amountIn, amountOut, false);
        return amountOut;
    }


    // --- Public Entry Points ---

    function swapHbarForToken(
        string calldata tokenOutSymbol, 
        uint256 minAmountOut, 
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        IERC20 tokenOut = _getToken(tokenOutSymbol);

        if (tokenOut == usdcToken || tokenOut == usdtToken) {
            // ORACLE ROUTE (HBAR -> USDC/USDT)
            _exactOracleSwapHbarForStable(tokenOut, tokenOutSymbol, msg.value, minAmountOut, priceUpdateData);
        } else if (tokenOut == wagerToken) {
            // AMM ROUTE (HBAR -> WAGER)
            // Any HBAR sent is the swap amount (no pyth fee needed here)
            _ammSwapHbarForWager(msg.value, minAmountOut);
        } else {
            revert("Unsupported swap path");
        }
    }

    function swapTokenForHbar(
        string calldata tokenInSymbol, 
        uint256 amountIn, 
        uint256 minAmountOut, 
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        IERC20 tokenIn = _getToken(tokenInSymbol);

        if (tokenIn == usdcToken || tokenIn == usdtToken) {
            // ORACLE ROUTE (USDC/USDT -> HBAR)
            // msg.value is just the Pyth update fee
            _exactOracleSwapStableForHbar(tokenIn, tokenInSymbol, amountIn, msg.value, minAmountOut, priceUpdateData);
        } else if (tokenIn == wagerToken) {
            // AMM ROUTE (WAGER -> HBAR)
            require(msg.value == 0, "No HBAR should be sent for this swap");
            _ammSwapWagerForHbar(amountIn, minAmountOut);
        } else {
            revert("Unsupported swap path");
        }
    }

    function swapTokenForToken(
        string calldata tokenInSymbol, 
        string calldata tokenOutSymbol, 
        uint256 amountIn, 
        uint256 minAmountOut,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        // EXPLICIT BLOCK: Stables <-> WAGER (and multi-hop) is strictly blocked by not supporting it here.
        // We only allow stable <-> stable for simplicity, or we can just revert completely.
        IERC20 tokenIn = _getToken(tokenInSymbol);
        IERC20 tokenOut = _getToken(tokenOutSymbol);

        if ((tokenIn == usdcToken || tokenIn == usdtToken) && (tokenOut == usdcToken || tokenOut == usdtToken)) {
            // Stable to Stable is inherently 1:1 in a zero-spread model, but let's just use 1:1
            require(msg.value == 0, "No fee needed for stable-stable");
            require(tokenOut.balanceOf(address(this)) >= amountIn, "Insufficient treasury liquidity");
            require(amountIn >= minAmountOut, "Slippage too high");

            require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "Transfer failed");
            require(tokenOut.transfer(msg.sender, amountIn), "Transfer failed");

            emit SwapTokenForToken(msg.sender, tokenInSymbol, tokenOutSymbol, amountIn, amountIn);
        } else {
            // Revert all other token-to-token swaps (e.g. WAGER <-> USDC)
            revert("BLOCKED ROUTE: Multi-hop or Stable<->WAGER not allowed");
        }
    }

    // Owner can withdraw liquidity or collected fees
    function withdrawLiquidity(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "HBAR transfer failed");
        } else {
            IERC20(tokenAddress).transfer(owner(), amount);
        }
    }

    receive() external payable {}
}
