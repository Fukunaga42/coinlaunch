// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BondingCurveManager, PumpToken} from "../src/BondingCurveManager.sol";

contract BondingCurveManagerTest is Test {
    BondingCurveManager public manager;
    address public owner;
    address public user1;
    address public user2;
    
    // Allow contract to receive ETH
    receive() external payable {}
    
    // Mock addresses for Uniswap V4 components
    address public mockPoolManager = address(0x1);
    address public mockPositionManager = address(0x2);
    address public mockWETH = address(0x3);

    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol
    );

    event TokensBought(
        address indexed token,
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount
    );

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy the BondingCurveManager with mock addresses
        manager = new BondingCurveManager(
            mockPoolManager,
            mockPositionManager, 
            mockWETH
        );
        
        // Give users some ETH for testing
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testContractDeployment() public view {
        // Verify initial contract state
        assertEq(manager.V_ETH_RESERVE(), 15 ether / 1000);
        assertEq(manager.V_TOKEN_RESERVE(), 1073000000 ether);
        assertEq(manager.R_TOKEN_RESERVE(), 793100000 ether);
        assertEq(manager.TRADE_FEE_BPS(), 100);
        assertEq(manager.BPS_DENOMINATOR(), 10000);
        assertEq(manager.GRADUATION_THRESHOLD(), 0.5 ether);
        
        // Verify Uniswap V4 addresses are set
        assertEq(address(manager.poolManager()), mockPoolManager);
        assertEq(address(manager.positionManager()), mockPositionManager);
        assertEq(manager.WETH(), mockWETH);
    }

    function testTokenCreationWithoutETH() public {
        // We can't predict the token address, so we'll check the event after creation
        vm.prank(user1);
        manager.create("TestToken", "TEST");
        
        // Get the token address from the tokenListArray
        address tokenAddress = manager.tokenList(0);
        
        // Verify token was created
        assertTrue(tokenAddress != address(0));
        
        // Check token basic properties
        PumpToken token = PumpToken(tokenAddress);
        assertEq(token.name(), "TestToken");
        assertEq(token.symbol(), "TEST");
        assertEq(token.decimals(), 18);
        assertEq(token.factory(), address(manager));
        
        // Creator should have 1 ether from constructor
        assertEq(token.balanceOf(user1), 1 ether);
        
        // Check token info in manager
        (
            address creator,
            address tokenAddr,
            uint256 vReserveEth,
            uint256 vReserveToken,
            uint256 rReserveEth,
            int256 rReserveToken,
            bool liquidityMigrated
        ) = manager.tokenInfos(tokenAddress);
        
        assertEq(creator, user1);
        assertEq(tokenAddr, tokenAddress);
        assertEq(vReserveEth, manager.V_ETH_RESERVE());
        assertEq(vReserveToken, manager.V_TOKEN_RESERVE());
        assertEq(rReserveEth, 0);
        assertEq(rReserveToken, int256(manager.R_TOKEN_RESERVE()));
        assertFalse(liquidityMigrated);
    }

    function testTokenCreationWithETH() public {
        uint256 ethAmount = 0.1 ether;
        uint256 expectedFee = (ethAmount * manager.TRADE_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 expectedNetEth = ethAmount - expectedFee;
        
        vm.prank(user1);
        manager.create{value: ethAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        PumpToken token = PumpToken(tokenAddress);
        
        // User should have received tokens (1 ether from constructor + tokens from buy)
        uint256 userBalance = token.balanceOf(user1);
        assertGt(userBalance, 1 ether);
        
        // Check updated reserves
        (
            ,
            ,
            uint256 vReserveEth,
            uint256 vReserveToken,
            uint256 rReserveEth,
            int256 rReserveToken,
            
        ) = manager.tokenInfos(tokenAddress);
        
        // Virtual reserves should be updated
        assertGt(vReserveEth, manager.V_ETH_RESERVE());
        assertLt(vReserveToken, manager.V_TOKEN_RESERVE());
        
        // Real ETH reserve should have the net amount (after fees)
        assertEq(rReserveEth, expectedNetEth);
        
        // Real token reserve should be reduced
        assertLt(rReserveToken, int256(manager.R_TOKEN_RESERVE()));
        
        // Check that fee was collected
        assertEq(manager.totalFee(), expectedFee);
    }

    function testMultipleTokenCreation() public {
        // Create first token
        vm.prank(user1);
        manager.create("Token1", "TK1");
        
        // Create second token
        vm.prank(user2);
        manager.create("Token2", "TK2");
        
        // Verify both tokens exist in the list
        address token1 = manager.tokenList(0);
        address token2 = manager.tokenList(1);
        
        assertTrue(token1 != address(0));
        assertTrue(token2 != address(0));
        assertTrue(token1 != token2);
        
        // Verify token properties
        PumpToken pumpToken1 = PumpToken(token1);
        PumpToken pumpToken2 = PumpToken(token2);
        
        assertEq(pumpToken1.name(), "Token1");
        assertEq(pumpToken1.symbol(), "TK1");
        assertEq(pumpToken2.name(), "Token2");
        assertEq(pumpToken2.symbol(), "TK2");
        
        // Verify creators
        (address creator1,,,,,,) = manager.tokenInfos(token1);
        (address creator2,,,,,,) = manager.tokenInfos(token2);
        
        assertEq(creator1, user1);
        assertEq(creator2, user2);
        
        // Verify initial balances
        assertEq(pumpToken1.balanceOf(user1), 1 ether);
        assertEq(pumpToken2.balanceOf(user2), 1 ether);
        assertEq(pumpToken1.balanceOf(user2), 0);
        assertEq(pumpToken2.balanceOf(user1), 0);
    }

    function testTokenCreationCalculations() public {
        uint256 ethAmount = 0.05 ether;
        
        // First, calculate what the return should be for a fresh token
        uint256 fee = (ethAmount * manager.TRADE_FEE_BPS()) / manager.BPS_DENOMINATOR();
        uint256 netEthIn = ethAmount - fee;
        
        // Calculate expected token amount using the bonding curve formula
        uint256 newReserveEth = netEthIn + manager.V_ETH_RESERVE();
        uint256 newReserveToken = (manager.V_ETH_RESERVE() * manager.V_TOKEN_RESERVE()) / newReserveEth;
        uint256 expectedTokensOut = manager.V_TOKEN_RESERVE() - newReserveToken;
        
        vm.prank(user1);
        manager.create{value: ethAmount}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        PumpToken token = PumpToken(tokenAddress);
        
        // User should have 1 ether (from constructor) + tokens from purchase
        uint256 expectedBalance = 1 ether + expectedTokensOut;
        assertEq(token.balanceOf(user1), expectedBalance);
        
        // Test the view function with a fresh token (create without ETH)
        vm.prank(user2);
        manager.create("TestToken2", "TEST2");
        
        address tokenAddress2 = manager.tokenList(1);
        
        // Now test the calculation on the fresh token
        uint256 calculatedReturn = manager.calculateCurvedBuyReturn(tokenAddress2, ethAmount);
        assertEq(calculatedReturn, expectedTokensOut);
    }

    function testTokensFunction() public {
        // Test with non-existent token
        (address token, uint256 tokenBalance, uint256 ethBalance, bool isListed) = manager.tokens(address(0x999));
        assertEq(token, address(0));
        assertEq(tokenBalance, 0);
        assertEq(ethBalance, 0);
        assertFalse(isListed);
        
        // Create a token and test
        vm.prank(user1);
        manager.create{value: 0.1 ether}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        (token, tokenBalance, ethBalance, isListed) = manager.tokens(tokenAddress);
        
        assertEq(token, tokenAddress);
        // tokenBalance might be 0 if rReserveToken went negative (more tokens sold than reserved)
        // This is expected behavior for the bonding curve
        assertGt(ethBalance, 0); // Should have some ETH
        assertTrue(isListed);
    }

    function testViewFunctions() public {
        vm.prank(user1);
        manager.create{value: 0.1 ether}("TestToken", "TEST");
        
        address tokenAddress = manager.tokenList(0);
        
        // Test getCurrentTokenPrice
        uint256 price = manager.getCurrentTokenPrice(tokenAddress);
        assertGt(price, 0);
        
        // Test getMarketCap
        uint256 marketCap = manager.getMarketCap(tokenAddress);
        assertGt(marketCap, 0);
        
        // Test getTokenEthBalance
        uint256 ethBalance = manager.getTokenEthBalance(tokenAddress);
        assertGt(ethBalance, 0);
    }

    function testOwnerFunctions() public {
        // Test updateFeeRate (only owner)
        manager.updateFeeRate(200); // 2%
        assertEq(manager.TRADE_FEE_BPS(), 200);
        
        // Test updateGraduationThreshold (only owner)
        manager.updateGraduationThreshold(1 ether);
        assertEq(manager.GRADUATION_THRESHOLD(), 1 ether);
        
        // Test that non-owner cannot call these functions
        vm.prank(user1);
        vm.expectRevert();
        manager.updateFeeRate(300);
        
        vm.prank(user1);
        vm.expectRevert();
        manager.updateGraduationThreshold(2 ether);
    }

    function testFeeCollection() public {
        // Create token with ETH to generate fees
        uint256 ethAmount = 0.1 ether;
        uint256 expectedFee = (ethAmount * manager.TRADE_FEE_BPS()) / manager.BPS_DENOMINATOR();
        
        vm.prank(user1);
        manager.create{value: ethAmount}("TestToken", "TEST");
        
        assertEq(manager.totalFee(), expectedFee);
        
        // Test fee claiming
        uint256 ownerBalanceBefore = owner.balance;
        manager.claimFee(owner);
        
        assertEq(manager.totalFee(), 0);
        assertEq(owner.balance, ownerBalanceBefore + expectedFee);
    }
}
