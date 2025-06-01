import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
const RPC_SEPOLIA = process.env.RPC_SEPOLIA as string;
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    sepolia: {
      url: RPC_SEPOLIA,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
  },
  etherscan: {
    enabled: false,
  },
  solidity: {
    version: "0.8.28",
    settings: {
      metadata: {
        bytecodeHash: "none", 
        useLiteralContent: true, 
      },
      remappings: [
        "v4-core/=lib/v4-core/",
        "v4-periphery/=lib/v4-periphery/",
        "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/"
      ]

    },
  },
};
export default config;
