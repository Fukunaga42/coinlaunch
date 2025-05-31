// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveManager, PumpToken} from "../src/BondingCurveManager.sol";

contract DebugMigration is Test {
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

    function testDebugMigration() public {
        uint256 graduationAmount = 0.6 ether;
        
        console.log("=== BEFORE CREATE ===");
        console.log("Graduation threshold:", manager.GRADUATION_THRESHOLD());
        console.log("Sending ETH amount:", graduationAmount);
        
        // Calculate expected values
        uint256 fee = (graduationAmount * manager.TRADE_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 netEthIn = graduationAmount - fee;
        
        console.log("Expected fee:", fee);
        console.log("Expected net ETH:", netEthIn);
        console.log("Should migrate?", netEthIn >= manager.GRADUATION_THRESHOLD());
        
        vm.prank(user1);
        manager.create{value: graduationAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        console.log("Token created at:", tokenAddress);
        
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
        
        console.log("=== AFTER CREATE ===");
        console.log("Creator:", creator);
        console.log("Token address:", tokenAddr);
        console.log("vReserveEth:", vReserveEth);
        console.log("vReserveToken:", vReserveToken);
        console.log("rReserveEth:", rReserveEth);
        console.log("rReserveToken:", rReserveToken);
        console.log("liquidityMigrated:", liquidityMigrated);
        
        console.log("=== MIGRATION CHECK ===");
        console.log("rReserveEth >= GRADUATION_THRESHOLD?", rReserveEth >= manager.GRADUATION_THRESHOLD());
        console.log("!liquidityMigrated?", !liquidityMigrated);
        console.log("Both conditions met?", rReserveEth >= manager.GRADUATION_THRESHOLD() && !liquidityMigrated);
        
        // The migration should have happened
        if (rReserveEth >= manager.GRADUATION_THRESHOLD()) {
            console.log("ERROR: Migration should have happened but liquidityMigrated is:", liquidityMigrated);
        }
    }

    function testMigrationWithMockFailure() public {
        uint256 graduationAmount = 0.6 ether;
        
        // Mock the WETH deposit to revert
        vm.mockCallRevert(
            mockWETH,
            abi.encodeWithSignature("deposit()"),
            "WETH deposit failed"
        );
        
        console.log("Testing with WETH mock that reverts...");
        
        vm.prank(user1);
        try manager.create{value: graduationAmount}("TestToken", "TEST") {
            console.log("Create succeeded despite WETH mock failure");
            
            address tokenAddress = manager.tokenList(0);
            (,,,,,, bool liquidityMigrated) = manager.tokenInfos(tokenAddress);
            console.log("liquidityMigrated:", liquidityMigrated);
            
        } catch Error(string memory reason) {
            console.log("Create failed with error:", reason);
        } catch {
            console.log("Create failed with unknown error");
        }
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
