// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveManager, PumpToken} from "../src/BondingCurveManager.sol";

contract SimpleMigrationTest is Test {
    BondingCurveManager public manager;
    address public user1;
    
    // Mock addresses for Uniswap V4 components
    address public mockPoolManager = address(0x1);
    address public mockPositionManager = address(0x2);
    address public mockWETH = address(0x3);

    function setUp() public {
        user1 = makeAddr("user1");
        
        manager = new BondingCurveManager(
            mockPoolManager,
            mockPositionManager, 
            mockWETH
        );
        
        vm.deal(user1, 10 ether);
    }

    function testCheckMigrationStatus() public {
        uint256 graduationAmount = 0.6 ether;
        
        console.log("=== CHECKING MIGRATION STATUS ===");
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        
        // Check token info
        (
            address creator,
            address tokenAddr,
            uint256 vReserveEth,
            uint256 vReserveToken,
            uint256 rReserveEth,
            int256 rReserveToken,
            bool liquidityMigrated
        ) = manager.tokenInfos(tokenAddress);
        
        console.log("=== TOKEN INFO ===");
        console.log("Creator:", creator);
        console.log("Token address:", tokenAddr);
        console.log("vReserveEth:", vReserveEth);
        console.log("vReserveToken:", vReserveToken);
        console.log("rReserveEth:", rReserveEth);
        console.log("rReserveToken:", rReserveToken);
        console.log("liquidityMigrated:", liquidityMigrated);
        
        console.log("=== GRADUATION CHECK ===");
        console.log("Graduation threshold:", manager.GRADUATION_THRESHOLD());
        console.log("rReserveEth >= threshold?", rReserveEth >= manager.GRADUATION_THRESHOLD());
        
        // Try to buy more tokens
        console.log("=== TESTING BUY AFTER MIGRATION ===");
        
        vm.prank(user1);
        try manager.buy{value: 0.1 ether}(tokenAddress) {
            console.log("Buy succeeded - migration did NOT happen");
        } catch Error(string memory reason) {
            console.log("Buy failed with reason:", reason);
            if (keccak256(bytes(reason)) == keccak256(bytes("Trading moved to Uniswap"))) {
                console.log("Migration DID happen - trading blocked");
            }
        }
    }

    function testBelowThresholdNoMigration() public {
        uint256 belowThresholdAmount = 0.4 ether; // Below 0.5 ETH threshold
        
        console.log("=== TESTING BELOW THRESHOLD ===");
        console.log("Amount:", belowThresholdAmount);
        console.log("Threshold:", manager.GRADUATION_THRESHOLD());
        
        vm.prank(user1);
        manager.create{value: belowThresholdAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
        
        console.log("liquidityMigrated:", liquidityMigrated);
        
        // Should be able to buy more
        vm.prank(user1);
        manager.buy{value: 0.1 ether}(tokenAddress);
        
        console.log("Buy succeeded - no migration as expected");
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
