import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    console.log("🚀 Starting BondingCurveManager deployment...");
    console.log("Network:", network.name);

    // Uniswap V2 Router address on Sepolia
    const SEPOLIA_UNISWAP_V2_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
        throw new Error("Deployer account has no ETH. Please fund your account first.");
    }

    try {
        // Get the contract factory
        console.log("📄 Getting BondingCurveManager contract factory...");
        const BondingCurveManager = await ethers.getContractFactory("BondingCurveManager");

        // Estimate gas for deployment
        const deploymentData = BondingCurveManager.interface.encodeDeploy([SEPOLIA_UNISWAP_V2_ROUTER]);
        const estimatedGas = await ethers.provider.estimateGas({
            data: deploymentData
        });

        // Get current gas price and calculate cost in ETH
        const gasPrice = await ethers.provider.getFeeData();
        const estimatedCostWei = estimatedGas * (gasPrice.gasPrice || 0n);
        const estimatedCostEth = ethers.formatEther(estimatedCostWei);

        console.log("Estimated gas for deployment:", estimatedGas.toString());
        console.log("Current gas price:", ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"), "gwei");
        console.log("Estimated deployment cost:", estimatedCostEth, "ETH");

        // Deploy the contract
        console.log("🔨 Deploying BondingCurveManager...");
        console.log("Router address:", SEPOLIA_UNISWAP_V2_ROUTER);

        const bondingCurveManager = await BondingCurveManager.deploy(SEPOLIA_UNISWAP_V2_ROUTER);

        // Wait for deployment
        console.log("⏳ Waiting for deployment confirmation...");
        await bondingCurveManager.waitForDeployment();

        const contractAddress = await bondingCurveManager.getAddress();
        const deploymentTx = bondingCurveManager.deploymentTransaction();

        console.log("✅ BondingCurveManager deployed successfully!");
        console.log("📍 Contract address:", contractAddress);
        console.log("🔗 Transaction hash:", deploymentTx?.hash);
        console.log("⛽ Gas used:", deploymentTx?.gasLimit?.toString());

        // Verify contract configuration
        console.log("\n🔍 Verifying contract configuration...");
        try {
            const uniswapRouter = await bondingCurveManager.uniswapRouter();
            const weth = await bondingCurveManager.WETH();
            const owner = await bondingCurveManager.owner();

            console.log("Uniswap Router:", uniswapRouter);
            console.log("WETH address:", weth);
            console.log("Contract owner:", owner);

            // Try to get additional configuration if available
            try {
                const vEthReserve = await bondingCurveManager.V_ETH_RESERVE();
                const vTokenReserve = await bondingCurveManager.V_TOKEN_RESERVE();
                const graduationThreshold = await bondingCurveManager.GRADUATION_THRESHOLD();

                console.log("Virtual ETH Reserve:", ethers.formatEther(vEthReserve), "ETH");
                console.log("Virtual Token Reserve:", ethers.formatEther(vTokenReserve), "tokens");
                console.log("Graduation Threshold:", ethers.formatEther(graduationThreshold), "ETH");
            } catch (configError) {
                console.log("Additional configuration details not available via public getters");
            }
        } catch (verificationError) {
            console.log("Contract verification skipped - functions may not be available");
            console.log("Contract deployed successfully at:", contractAddress);
        }

        // Save deployment info
        const deploymentInfo = {
            network: network.name,
            contractAddress: contractAddress,
            transactionHash: deploymentTx?.hash,
            deployer: deployer.address,
            routerAddress: SEPOLIA_UNISWAP_V2_ROUTER,
            deployedAt: new Date().toISOString(),
            gasUsed: deploymentTx?.gasLimit?.toString(),
            estimatedCostEth: estimatedCostEth
        };

        // Create deployments directory if it doesn't exist
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        // Save deployment info to file
        const deploymentFile = path.join(deploymentsDir, `BondingCurveManager-${network.name}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log("💾 Deployment info saved to:", deploymentFile);

        console.log("\n🎉 Deployment completed successfully!");
        console.log("You can now interact with your BondingCurveManager at:", contractAddress);

    } catch (error) {
        console.error("❌ Deployment failed:");
        console.error(error);
        throw error;
    }
}

// Execute the deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

