// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BondingCurveManager} from "../src/BondingCurveManager.sol";

contract DeployBondingCurve is Script {
    // Uniswap V4 addresses on Sepolia
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    
    function run() external {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Starting BondingCurveManager deployment...");
        console.log("Network: Sepolia (Chain ID: 11155111)");
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
        console.log("Network: Sepolia");
        console.log("Contract: BondingCurveManager");
        console.log("Address:", contractAddress);
        console.log("Deployer:", deployer);
        console.log("PoolManager:", POOL_MANAGER);
        console.log("PositionManager:", POSITION_MANAGER);
    }
}
