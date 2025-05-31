// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveManager, PumpToken} from "../src/BondingCurveManager.sol";

contract MigrationTest is Test {
    BondingCurveManager public manager;
    address public owner;
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
        owner = address(this);
        user1 = makeAddr("user1");
        
        // Deploy the BondingCurveManager with mock addresses
        manager = new BondingCurveManager(
            mockPoolManager,
            mockPositionManager, 
            mockWETH
        );
        
        // Give user enough ETH to reach graduation threshold
        vm.deal(user1, 10 ether);
    }

    function testMigrationTriggeredOnCreate() public {
        // The graduation threshold is 0.5 ether
        uint256 graduationAmount = 0.6 ether; // Above threshold
        
        console.log("Testing migration on token creation...");
        console.log("Graduation threshold:", manager.GRADUATION_THRESHOLD());
        console.log("Sending ETH amount:", graduationAmount);
        
        // Calculate expected net ETH after fees
        uint256 fee = (graduationAmount * manager.TRADE_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 netEthIn = graduationAmount - fee;
        
        console.log("Expected fee:", fee);
        console.log("Expected net ETH:", netEthIn);
        console.log("Net ETH >= threshold?", netEthIn >= manager.GRADUATION_THRESHOLD());
        
        // Expect the LiquidityAdded event to be emitted (indicating migration)
        vm.expectEmit(true, false, false, false);
        emit LiquidityAdded(address(0), 0, 0); // We can't predict the exact token address
        
        vm.prank(user1);
        // This should trigger migration because netEthIn (0.594 ETH) >= 0.5 ETH threshold
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        
        // Check that liquidityMigrated is true
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        assertTrue(liquidityMigrated, "Token should be migrated");
        
        console.log("Migration status:", liquidityMigrated);
    }

    function testMigrationTriggeredOnBuy() public {
        // First create a token without reaching threshold
        vm.prank(user1);
        manager.create{value: 0.1 ether}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        
        // Check initial state
        (,,,, uint256 rReserveEth,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        assertFalse(liquidityMigrated, "Token should not be migrated initially");
        
        console.log("Initial rReserveEth:", rReserveEth);
        console.log("Graduation threshold:", manager.GRADUATION_THRESHOLD());
        
        // Calculate how much more ETH we need to reach graduation
        uint256 needed = manager.GRADUATION_THRESHOLD() - rReserveEth;
        uint256 buyAmount = needed + 0.1 ether; // Add extra to account for fees
        
        console.log("Additional ETH needed:", needed);
        console.log("Buy amount (with buffer):", buyAmount);
        
        // Expect the LiquidityAdded event to be emitted
        vm.expectEmit(true, false, false, false);
        emit LiquidityAdded(tokenAddress, 0, 0);
        
        vm.prank(user1);
        manager.buy{value: buyAmount}(tokenAddress);
        
        // Check that migration happened
        (,,,, uint256 finalRReserveEth,, bool finalLiquidityMigrated) = manager.tokenInfos(tokenAddress);
        assertTrue(finalLiquidityMigrated, "Token should be migrated after buy");
        
        console.log("Final rReserveEth:", finalRReserveEth);
        console.log("Final migration status:", finalLiquidityMigrated);
    }

    function testMigrationFailsWithMockContracts() public {
        // This test demonstrates that migration will fail with mock contracts
        // because the Uniswap V4 calls will revert
        
        uint256 graduationAmount = 0.6 ether;
        
        // Mock the WETH contract to make deposit fail
        vm.mockCall(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            abi.encode()
        );
        
        vm.prank(user1);
        // This will likely revert or fail silently due to mock contracts
        try manager.create{value: graduationAmount}("TestToken", "TEST") {
            address tokenAddress = manager.tokenList(0);
            (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
            
            // If we get here, check if migration actually worked
            console.log("Migration completed with mocks:", liquidityMigrated);
        } catch Error(string memory reason) {
            console.log("Migration failed with error:", reason);
        } catch {
            console.log("Migration failed with unknown error");
        }
    }

    function testGraduationThresholdCalculation() public {
        // Test that the graduation threshold calculation is correct
        uint256 ethAmount = 0.6 ether;
        uint256 fee = (ethAmount * manager.TRADE_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 netEthIn = ethAmount - fee;
        
        console.log("ETH amount:", ethAmount);
        console.log("Fee (1%):", fee);
        console.log("Net ETH:", netEthIn);
        console.log("Graduation threshold:", manager.GRADUATION_THRESHOLD());
        console.log("Will graduate?", netEthIn >= manager.GRADUATION_THRESHOLD());
        
        // With 1% fee, 0.6 ETH becomes 0.594 ETH net
        // This should be >= 0.5 ETH threshold
        assertTrue(netEthIn >= manager.GRADUATION_THRESHOLD(), "Should meet graduation threshold");
    }

    function testBelowThresholdNoMigration() public {
        // Test that tokens below threshold don't migrate
        uint256 belowThresholdAmount = 0.4 ether; // Below 0.5 ETH threshold
        
        vm.prank(user1);
        manager.create{value: belowThresholdAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        
        assertFalse(liquidityMigrated, "Token below threshold should not migrate");
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
