import { Chain } from 'viem'
import { sepolia } from 'wagmi/chains'

interface ChainConfig {
  apiBaseUrl: string
  wsBaseUrl: string
  blockscoutUrl: string
  dexTarget: number
  contractAddresses: string[]
}

interface ChainConfigs {
  [chainId: number]: ChainConfig
}

// Sepolia Chain Configuration
const sepoliaConfig: ChainConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_SEPOLIA_API_BASE_URL!,
  wsBaseUrl: process.env.SEPOLIA_NEXT_PUBLIC_WS_BASE_URL!,
  blockscoutUrl: process.env.SEPOLIA_NEXT_PUBLIC_BLOCKSCOUT_URL!,
  dexTarget: Number(process.env.SEPOLIA_NEXT_PUBLIC_DEX_TARGET),
  contractAddresses: [
    process.env.SEPOLIA_NEXT_PUBLIC_SEPOLIA_BONDING_CURVE_MANAGER_ADDRESS!,
  ].filter(Boolean)
}

// Custom WorldChain definition
const worldChain: Chain = {
  id: 480,
  name: 'World Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_WORLDCHAIN_API_BASE_URL!],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_WORLDCHAIN_API_BASE_URL!],
    },
  },
  blockExplorers: {
    default: { name: 'WorldScan', url: process.env.NEXT_PUBLIC_WORLDCHAIN_BLOCKSCOUT_URL! },
  },
}

// WorldChain Configuration
const worldChainConfig: ChainConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_WORLDCHAIN_API_BASE_URL!,
  wsBaseUrl: process.env.NEXT_PUBLIC_WORLDCHAIN_WS_BASE_URL!,
  blockscoutUrl: process.env.NEXT_PUBLIC_WORLDCHAIN_BLOCKSCOUT_URL!,
  dexTarget: Number(process.env.NEXT_PUBLIC_WORLDCHAIN_DEX_TARGET),
  contractAddresses: [
    process.env.NEXT_PUBLIC_WORLDCHAIN_BONDING_CURVE_MANAGER_ADDRESS!
  ].filter(Boolean)
}

// Chain configurations mapped by chainId
export const chainConfigs: ChainConfigs = {
  [sepolia.id]: sepoliaConfig,
  [480]: worldChainConfig,
}

// Custom Sepolia chain with your specific RPC URL
const customSepolia: Chain = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_SEPOLIA_API_BASE_URL!],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_SEPOLIA_API_BASE_URL!],
    },
  },
}



// Supported chains for the application with custom RPC URLs
export const supportedChains: Chain[] = [
  customSepolia,
  worldChain,
]

// Helper function to get chain configuration by chainId
export const getChainConfig = (chainId: number): ChainConfig | undefined => {
  return chainConfigs[chainId]
}

// Helper function to get current active contract address for a chain //wrong ill fix later on
export const getActiveContractAddress = (chainId: number): string | undefined => {
  const config = chainConfigs[chainId]
  return config?.contractAddresses[0] // Returns the most recent contract address
}
