// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockUniswapV2Router {
    address public WETH;
    
    constructor(address _weth) {
        WETH = _weth;
    }
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        // Mock implementation - just return the input values
        return (amountTokenDesired, msg.value, 1000);
    }
}
