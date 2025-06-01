// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BondingCurveManager} from "../src/BondingCurveManager.sol";

contract DeployBondingCurve is Script {
    // Uniswap V4 addresses on worldchain
    address constant POOL_MANAGER = 0xb1860D529182ac3BC1F51Fa2ABd56662b7D13f33;
    address constant POSITION_MANAGER = 0xC585E0f504613b5fBf874F21Af14c65260fB41fA;
    
    function run() external {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Starting BondingCurveManager deployment...");
        console.log("Network: worldchain (Chain ID: 11155111)");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        
        // Verify we have enough ETH
        require(deployer.balance > 0, "Deployer account has no ETH");
        
        console.log("\nUniswap V4 Configuration:");
        console.log("PoolManager:", POOL_MANAGER);
        console.log("PositionManager:", POSITION_MANAGER);
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\nDeploying BondingCurveManager...");
        
        // Deploy the contract
        BondingCurveManager bondingCurveManager = new BondingCurveManager(
            POOL_MANAGER,
            POSITION_MANAGER
        );
        
        vm.stopBroadcast();
        
        address contractAddress = address(bondingCurveManager);
        console.log("\nBondingCurveManager deployed successfully!");
        console.log("Contract address:", contractAddress);
        
        // Verify contract configuration
        console.log("\nVerifying contract configuration...");
        console.log("Pool Manager:", address(bondingCurveManager.poolManager()));
        console.log("Position Manager:", address(bondingCurveManager.positionManager()));
        console.log("Owner:", bondingCurveManager.owner());
        
        // Display contract parameters
        console.log("\nContract Parameters:");
        console.log("V_ETH_RESERVE:", bondingCurveManager.V_ETH_RESERVE() / 1e18, "ETH");
        console.log("V_TOKEN_RESERVE:", bondingCurveManager.V_TOKEN_RESERVE() / 1e18, "tokens");
        console.log("R_TOKEN_RESERVE:", bondingCurveManager.R_TOKEN_RESERVE() / 1e18, "tokens");
        console.log("TRADE_FEE_BPS:", bondingCurveManager.TRADE_FEE_BPS());
        console.log("GRADUATION_THRESHOLD:", bondingCurveManager.GRADUATION_THRESHOLD() / 1e18, "ETH");
        
        // Display Uniswap V4 configuration
        console.log("\nUniswap V4 Configuration:");
        console.log("Fee Tier:", bondingCurveManager.UNISWAP_FEE_TIER());
        console.log("Tick Spacing:", bondingCurveManager.TICK_SPACING());
        
        console.log("\nDeployment completed successfully!");
        console.log("Contract address:", contractAddress);
        console.log("\nNext steps:");
        console.log("1. Verify the contract on Etherscan (optional)");
        console.log("2. Update your frontend with the new contract address");
        console.log("3. Test token creation and trading functionality");
        
        // Save deployment info to a file (this will be logged)
        console.log("\nDeployment Summary:");
        console.log("Network: worldchain");
        console.log("Contract: BondingCurveManager");
        console.log("Address:", contractAddress);
        console.log("Deployer:", deployer);
        console.log("PoolManager:", POOL_MANAGER);
        console.log("PositionManager:", POSITION_MANAGER);
    }
}
