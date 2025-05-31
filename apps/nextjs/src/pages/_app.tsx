import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { WagmiConfig, createConfig, WagmiProvider } from "wagmi";
import { supportedChains } from "@/chain/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";
import { http } from "viem";
import { PrivyProvider } from "@privy-io/react-auth";

// Create custom wagmi config with your specific RPC URLs
const config = getDefaultConfig({
  appName: "The launch",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: supportedChains as any,
  transports: {
    [supportedChains[0].id]: http(process.env.NEXT_PUBLIC_SEPOLIA_API_BASE_URL),
  },
  ssr: true,
});

const queryClient = new QueryClient();
const PRIVY_APP_ID: string = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <PrivyProvider
            appId={PRIVY_APP_ID}

            config={{
                autoConnect: false,
              appearance: {
                theme: "dark",
                accentColor: "#9333EA",
                showWalletLoginFirst: false,
                walletChainType: "ethereum-only",
              },
              loginMethods: ["twitter"],
              embeddedWallets: {
                ethereum: {
                  createOnLogin: "all-users",
                },
                solana: {
                  createOnLogin: "off",
                },
              },
            }}
          >
            <WebSocketProvider>
              <Component {...pageProps} />
            </WebSocketProvider>
          </PrivyProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
      <ToastContainer />
    </WagmiConfig>
  );
}
