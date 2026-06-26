// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WagerSwapPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public wagerToken;
    IERC20 public usdcToken;
    IERC20 public usdtToken;

    event Swap(address indexed user, string tokenIn, string tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address _wagerToken, address _usdcToken, address _usdtToken) Ownable(msg.sender) {
        wagerToken = IERC20(_wagerToken);
        usdcToken = IERC20(_usdcToken);
        usdtToken = IERC20(_usdtToken);
    }

    function _getToken(string memory symbol) internal view returns (IERC20) {
        if (keccak256(bytes(symbol)) == keccak256(bytes("$WAGER")) || keccak256(bytes(symbol)) == keccak256(bytes("WAGER"))) return wagerToken;
        if (keccak256(bytes(symbol)) == keccak256(bytes("USDC"))) return usdcToken;
        if (keccak256(bytes(symbol)) == keccak256(bytes("USDT"))) return usdtToken;
        revert("Unsupported token");
    }

    // Allow contract to receive HBAR natively
    receive() external payable {}

    // Swap HBAR for any Token
    function swapHbarForToken(string calldata tokenOut, uint256 minAmountOut) external payable {
        require(msg.value > 0, "Must send HBAR");
        
        IERC20 token = _getToken(tokenOut);
        uint256 reserveIn = address(this).balance - msg.value; // HBAR reserve before swap
        uint256 reserveOut = token.balanceOf(address(this));
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient pool liquidity");
        
        // Constant Product Math: dy = (y * dx) / (x + dx)
        uint256 amountOut = (reserveOut * msg.value) / (reserveIn + msg.value);
        require(amountOut >= minAmountOut, "Slippage too high");
        
        token.safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, "HBAR", tokenOut, msg.value, amountOut);
    }

    // Swap any Token for HBAR
    function swapTokenForHbar(string calldata tokenIn, uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "Amount must be > 0");
        
        IERC20 token = _getToken(tokenIn);
        uint256 reserveIn = token.balanceOf(address(this));
        uint256 reserveOut = address(this).balance;
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient pool liquidity");
        
        // Constant Product Math: dy = (y * dx) / (x + dx)
        uint256 amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
        require(amountOut >= minAmountOut, "Slippage too high");
        
        token.safeTransferFrom(msg.sender, address(this), amountIn);
        payable(msg.sender).transfer(amountOut);
        emit Swap(msg.sender, tokenIn, "HBAR", amountIn, amountOut);
    }

    // Swap Token for Token
    function swapTokenForToken(string calldata tokenIn, string calldata tokenOut, uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "Amount must be > 0");
        
        IERC20 tIn = _getToken(tokenIn);
        IERC20 tOut = _getToken(tokenOut);
        
        uint256 reserveIn = tIn.balanceOf(address(this));
        uint256 reserveOut = tOut.balanceOf(address(this));
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient pool liquidity");
        
        uint256 amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
        require(amountOut >= minAmountOut, "Slippage too high");
        
        tIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tOut.safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    // Legacy function for HBAR -> WAGER compatibility
    function swapHbarForWager(uint256 minAmountOut) external payable {
        require(msg.value > 0, "Must send HBAR");
        
        uint256 reserveIn = address(this).balance - msg.value;
        uint256 reserveOut = wagerToken.balanceOf(address(this));
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient pool liquidity");
        
        uint256 amountOut = (reserveOut * msg.value) / (reserveIn + msg.value);
        require(amountOut >= minAmountOut, "Slippage too high");
        
        wagerToken.safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, "HBAR", "$WAGER", msg.value, amountOut);
    }

    // Legacy function for WAGER -> HBAR compatibility
    function swapWagerForHbar(uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "Amount must be > 0");
        
        uint256 reserveIn = wagerToken.balanceOf(address(this));
        uint256 reserveOut = address(this).balance;
        
        require(reserveIn > 0 && reserveOut > 0, "Insufficient pool liquidity");
        
        uint256 amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
        require(amountOut >= minAmountOut, "Slippage too high");
        
        wagerToken.safeTransferFrom(msg.sender, address(this), amountIn);
        payable(msg.sender).transfer(amountOut);
        emit Swap(msg.sender, "$WAGER", "HBAR", amountIn, amountOut);
    }

    function withdrawHbar(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    function withdrawToken(string calldata tokenSymbol, uint256 amount) external onlyOwner {
        IERC20 token = _getToken(tokenSymbol);
        token.safeTransfer(owner(), amount);
    }
}
