// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveManager, PumpToken} from "../src/BondingCurveManager.sol";

contract MigrationRealWorld is Test {
    BondingCurveManager public manager;
    address public user1;
    
    // Mock addresses for Uniswap V4 components
    address public mockPoolManager = address(0x1);
    address public mockPositionManager = address(0x2);
    address public mockWETH = address(0x3);

    event LiquidityAdded(
        address indexed token,
        uint256 ethAmount,
        uint256 tokenAmount
    );

    function setUp() public {
        user1 = makeAddr("user1");
        
        manager = new BondingCurveManager(
            mockPoolManager,
            mockPositionManager, 
            mockWETH
        );
        
        vm.deal(user1, 10 ether);
    }

    function testMigrationMarksAsCompletedEvenWhenFailing() public {
        uint256 graduationAmount = 0.6 ether;
        
        console.log("=== TESTING MIGRATION WITH FAILING UNISWAP CALLS ===");
        
        // Mock all Uniswap V4 calls to revert
        vm.mockCallRevert(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            "WETH deposit failed"
        );
        
        vm.mockCallRevert(
            mockPoolManager,
            abi.encodeWithSignature("unlock(bytes)"),
            "PoolManager unlock failed"
        );
        
        // Expect LiquidityAdded event to be emitted even if migration fails
        vm.expectEmit(true, false, false, false);
        emit LiquidityAdded(address(0), 0, 0);
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        
        console.log("liquidityMigrated after failed Uniswap calls:", liquidityMigrated);
        
        // This shows the problem: migration is marked as complete even when it fails
        assertTrue(liquidityMigrated, "Migration marked as complete even when Uniswap calls fail");
        
        console.log("PROBLEM: Token is marked as migrated but liquidity was never actually added to Uniswap!");
    }

    function testTradingBlockedAfterFailedMigration() public {
        uint256 graduationAmount = 0.6 ether;
        
        // Mock Uniswap calls to fail
        vm.mockCallRevert(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            "WETH deposit failed"
        );
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        
        // Now try to buy more tokens - this should fail because liquidityMigrated = true
        vm.prank(user1);
        vm.expectRevert("Trading moved to Uniswap");
        manager.buy{value: 0.1 ether}(tokenAddress);
        
        console.log("PROBLEM: Trading is blocked but no liquidity exists on Uniswap!");
        console.log("Users can't trade the token anywhere!");
    }

    function testSolutionWithTryCatch() public view {
        console.log("=== SOLUTION ===");
        console.log("The _migrateToUniswapV4 function should use try/catch");
        console.log("to only mark liquidityMigrated = true if migration actually succeeds");
        console.log("If migration fails, keep liquidityMigrated = false so trading can continue");
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
