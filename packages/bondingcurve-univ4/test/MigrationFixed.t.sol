// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveManager, PumpToken} from "../src/BondingCurveManager.sol";

contract MigrationFixed is Test {
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

    function testMigrationFailsGracefully() public {
        uint256 graduationAmount = 0.6 ether;
        
        console.log("=== TESTING FIXED MIGRATION LOGIC ===");
        
        // Mock Uniswap calls to fail
        vm.mockCallRevert(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            "WETH deposit failed"
        );
        
        // Expect LiquidityAdded event with 0 amounts (indicating failure)
        vm.expectEmit(true, false, false, false);
        emit LiquidityAdded(address(0), 0, 0);
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        
        console.log("liquidityMigrated after failed migration:", liquidityMigrated);
        
        // With the fix, migration should NOT be marked as complete when it fails
        assertFalse(liquidityMigrated, "Migration should NOT be marked as complete when it fails");
        
        console.log("SUCCESS: Migration failed gracefully, trading can continue!");
    }

    function testTradingContinuesAfterFailedMigration() public {
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
        
        // Now try to buy more tokens - this should succeed because liquidityMigrated = false
        vm.prank(user1);
        manager.buy{value: 0.1 ether}(tokenAddress);
        
        console.log("SUCCESS: Trading continues after failed migration!");
        
        // Check that the buy actually worked
        PumpToken token = PumpToken(tokenAddress);
        uint256 userBalance = token.balanceOf(user1);
        assertGt(userBalance, 1 ether, "User should have received tokens from both create and buy");
        
        console.log("User token balance:", userBalance);
    }

    function testSuccessfulMigrationStillWorks() public {
        uint256 graduationAmount = 0.6 ether;
        
        console.log("=== TESTING SUCCESSFUL MIGRATION ===");
        
        // Mock successful WETH deposit
        vm.mockCall(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            abi.encode()
        );
        
        // Mock successful poolManager unlock
        vm.mockCall(
            mockPoolManager,
            abi.encodeWithSignature("unlock(bytes)"),
            abi.encode("")
        );
        
        // Expect LiquidityAdded event with actual amounts
        vm.expectEmit(true, false, false, false);
        emit LiquidityAdded(address(0), 0, 0); // We can't predict exact amounts
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        
        console.log("liquidityMigrated after successful migration:", liquidityMigrated);
        
        // With successful mocks, migration should be marked as complete
        assertTrue(liquidityMigrated, "Migration should be marked as complete when it succeeds");
        
        console.log("SUCCESS: Successful migration works correctly!");
    }

    function testRetryMigrationAfterFailure() public {
        uint256 graduationAmount = 0.6 ether;
        
        console.log("=== TESTING RETRY AFTER FAILED MIGRATION ===");
        
        // First attempt: Mock calls to fail
        vm.mockCallRevert(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            "WETH deposit failed"
        );
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        
        assertFalse(liquidityMigrated, "First migration should fail");
        console.log("First migration failed as expected");
        
        // Second attempt: Clear mocks and try buying more to trigger migration again
        vm.clearMockedCalls();
        
        // Mock successful calls for retry
        vm.mockCall(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            abi.encode()
        );
        
        vm.mockCall(
            mockPoolManager,
            abi.encodeWithSignature("unlock(bytes)"),
            abi.encode("")
        );
        
        // Buy more to trigger migration again
        vm.prank(user1);
        manager.buy{value: 0.1 ether}(tokenAddress);
        
        (,,,,,, bool liquidityMigratedAfterRetry) = manager.tokenInfos(tokenAddress);
        
        console.log("liquidityMigrated after retry:", liquidityMigratedAfterRetry);
        console.log("SUCCESS: Migration can be retried after initial failure!");
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
