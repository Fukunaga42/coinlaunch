import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import TokenUpdateModal from "@/components/token/TokenUpdateModal";
import LoadingBar from "@/components/ui/LoadingBar";
import { PaginatedResponse, Token, Transaction } from "@/interface/types";
import {
  getAllTokenAddresses,
  getTokensByCreator,
  getTransactionsByAddress,
} from "@/utils/api";
import {
  formatAddressV2,
  formatAmountV3,
  formatTimestamp,
  useERC20Balance,
} from "@/utils/blockchainUtils";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import axios from "axios";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface TransactionResponse
  extends Omit<PaginatedResponse<Transaction>, "data"> {
  transactions: Transaction[];
}

interface TokenBalanceItemProps {
  tokenAddress: string;
  symbol: string;
  userAddress: string;
  onClick: () => void;
}

const TokenBalanceItem: React.FC<TokenBalanceItemProps> = ({
  tokenAddress,
  symbol,
  userAddress,
  onClick,
}) => {
  const { balance } = useERC20Balance(
    tokenAddress as `0x${string}`,
    userAddress as `0x${string}`
  );

  if (!balance || balance.toString() === "0") {
    return null;
  }

  const handleAddressClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(
      `https://eth-sepolia.blockscout.com/address/${tokenAddress}`,
      "_blank"
    );
  };

  return (
    <div
      className="bg-[var(--card)] rounded-lg p-4 cursor-pointer hover:bg-[var(--card-hover)] transition-colors duration-200"
      onClick={onClick}
    >
      <h3 className="text-xs sm:text-sm font-semibold text-white mb-2">
        {symbol}
      </h3>
      <p className="text-gray-400 text-[10px] sm:text-xs">
        Balance: {formatAmountV3(balance.toString())}
      </p>
      <p className="text-gray-400 text-[10px] sm:text-xs mt-2">
        Address:
        <span
          className="text-[var(--primary)] hover:underline ml-1 cursor-pointer"
          onClick={handleAddressClick}
        >
          {formatAddressV2(tokenAddress)}
        </span>
      </p>
    </div>
  );
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="flex justify-center items-center space-x-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-md bg-[var(--card)] text-gray-400 hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
      <div className="flex items-center space-x-1">
        {[...Array(totalPages)].map((_, index) => {
          const page = index + 1;
          if (
            page === 1 ||
            page === totalPages ||
            (page >= currentPage - 1 && page <= currentPage + 1)
          ) {
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-1 rounded-md text-sm transition-colors duration-200 ${
                  currentPage === page
                    ? "bg-[var(--primary)] text-black"
                    : "bg-[var(--card)] text-gray-400 hover:bg-[var(--card-hover)]"
                }`}
              >
                {page}
              </button>
            );
          } else if (page === currentPage - 2 || page === currentPage + 2) {
            return (
              <span key={page} className="text-gray-500 text-xs sm:text-sm">
                ...
              </span>
            );
          }
          return null;
        })}
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-md bg-[var(--card)] text-gray-400 hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </div>
  );
};

interface TokenTabProps {
  title: string;
  isActive: boolean;
  onClick: () => void;
}

const TokenTab: React.FC<TokenTabProps> = ({ title, isActive, onClick }) => (
  <button
    className={`w-full rounded-lg py-2.5 text-xs sm:text-sm font-medium leading-5 ${
      isActive
        ? "bg-[var(--card-boarder)] text-white"
        : "text-gray-400 hover:bg-[var(--card-hover)] hover:text-white"
    }`}
    onClick={onClick}
  >
    {title}
  </button>
);

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const { address: profileAddress } = router.query;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [twitterId, setTwitterId] = useState<string | null>(null);

  const [tokenAddresses, setTokenAddresses] = useState<
    Array<{ address: string; symbol: string }>
  >([]);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"held" | "created">("held");
  const [createdTokens, setCreatedTokens] = useState<Token[]>([]);
  const [createdTokensPage, setCreatedTokensPage] = useState(1);
  const [createdTokensTotalPages, setCreatedTokensTotalPages] = useState(1);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const { user, authenticated, logout, getAccessToken, ready } = usePrivy();

  const { initOAuth } = useLoginWithOAuth();



  const addressToUse = (profileAddress as string) || connectedAddress || "";

  const fetchTransactions = useCallback(
    async (address: string, page: number) => {
      setIsLoading(true);
      try {
        const response: TransactionResponse = await getTransactionsByAddress(
          address,
          page
        );
        setTransactions(response.transactions);
        setTotalPages(response.totalPages);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchTokenAddresses = useCallback(async () => {
    try {
      const addresses = await getAllTokenAddresses();
      setTokenAddresses(addresses);
    } catch (error) {
      console.error("Error fetching token addresses:", error);
    }
  }, []);

  const fetchCreatedTokens = useCallback(
    async (creatorAddress: string, page: number) => {
      debugger

      setIsLoading(true);
      try {
        const response = await getTokensByCreator(creatorAddress, page);
        setCreatedTokens(response.tokens);
        setCreatedTokensTotalPages(response.totalPages);
      } catch (error) {
        console.error("Error fetching created tokens:", error);
        setCreatedTokens([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );


  useEffect(() => {
    if (!ready || !addressToUse) return;

    // Get Twitter ID from linked accounts
    const twitter = user?.linkedAccounts?.find(
        (acc) => acc.type === "twitter_oauth"
    );

    if (twitter?.subject) {
      setTwitterId(twitter.subject);
    }

    fetchTransactions(addressToUse, currentPage);
    fetchTokenAddresses();
  }, [
    ready,
    user,
    addressToUse,
    currentPage,
    fetchTransactions,
    fetchTokenAddresses,
  ]);

  useEffect(() => {
    if (!twitterId || !addressToUse) return;

    fetchCreatedTokens(twitterId, createdTokensPage);
  }, [twitterId, addressToUse, createdTokensPage, fetchCreatedTokens]);



  useEffect(() => {
    const syncPrivyAuth = async () => {
      if (!authenticated) return;
      const token = await getAccessToken();
      if (!token) return;
      try {
        await axios.get("/api/auth/privy", {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Auth sync failed:", err);
      }
    };
    syncPrivyAuth();
  }, [authenticated, getAccessToken]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const getTokenSymbol = (tokenAddress: string) => {
    const token = tokenAddresses.find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    return token ? token.symbol : "Unknown";
  };

  const handleTokenClick = (tokenAddress: string) => {
    setIsTokenLoading(true);
    router.push(`/token/${tokenAddress}`).finally(() => {
      setIsTokenLoading(false);
    });
  };

  const handleCreatedTokensPageChange = (newPage: number) => {
    setCreatedTokensPage(newPage);
  };

  const isTokenIncomplete = (token: Token) => {
    // Count how many social links are set
    const socialCount = [
      token.website,
      token.telegram,
      token.discord,
      token.twitter,
      token.youtube,
    ].filter(Boolean).length;

    // Return true if token needs more info (is incomplete)
    return !token.logo || !token.description || socialCount < 3;
  };

  return (
      <Layout>
        <SEO
            title={`${
                addressToUse
                    ? `Profile: ${formatAddressV2(addressToUse)}`
                    : "Your Profile"
            } - Coinlaunch`}
            description={`View token holdings and transactions for ${
                addressToUse ? formatAddressV2(addressToUse) : "your account"
            }.`}
            image="seo/profile.jpg"
        />


        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {addressToUse === connectedAddress
                ? "Your Profile"
                : `Profile: ${formatAddressV2(addressToUse)}`}
          </h1>

          <div className="mb-8">


            <div>
              {!authenticated ? (
                  <div className="flex justify-start items-center gap-2 mb-4"> {/* changed from justify-center */}
                    <div className="flex items-center space-x-1">
                      <button
                          disabled={!ready}
                          onClick={() => initOAuth({provider: "twitter"})}
                          className="text-sm text-blue-400 hover:underline"
                      >
                        Connect Twitter
                      </button>
                      <p className="text-sm text-gray-500">
                        to manage your created tokens
                      </p>
                    </div>


                  </div>
              ) : (
                  <>
                    <div className="flex justify-start items-center gap-2 mb-4"> {/* changed from justify-end */}
                      <span className="text-sm text-gray-400">@{user?.twitter?.username}</span>
                      <button
                          onClick={logout}
                          className="text-sm text-red-400 hover:underline"
                      >
                        Disconnect
                      </button>
                    </div>
                  </>
              )}
            </div>


            <div className="flex justify-center mb-4 space-x-1 bg-[var(--card2)] rounded-lg p-1">
              <TokenTab
                  title="Tokens Held"
                  isActive={activeTab === "held"}
                  onClick={() => setActiveTab("held")}
              />
              <TokenTab
                  title="Tokens Created"
                  isActive={activeTab === "created"}
                  onClick={() => setActiveTab("created")}
              />
            </div>

            {activeTab === "held" && (
                <div>
                  {tokenAddresses.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tokenAddresses.map((token) => (
                            <TokenBalanceItem
                                key={token.address}
                                tokenAddress={token.address}
                                symbol={token.symbol}
                                userAddress={addressToUse}
                                onClick={() => handleTokenClick(token.address)}
                            />
                        ))}
                      </div>
                  ) : (
                      <p className="text-gray-400 text-center text-sm sm:text-base">
                        No tokens held
                      </p>
                  )}
                </div>
            )}

            {activeTab === "created" && (
                <div>
                  {isLoading ? (
                      <div className="flex justify-center py-8">
                        <LoadingBar size="medium" />
                      </div>
                  ) : createdTokens.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {createdTokens.map((token) => (
                            <div
                                key={token.address}
                                className="bg-[var(--card)] rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-[var(--card-hover)] transition-colors duration-200 flex items-start relative"
                                onClick={() => handleTokenClick(token.address)}
                            >
                              {connectedAddress &&
                                  connectedAddress.toLowerCase() ===
                                  addressToUse.toLowerCase() &&
                                  isTokenIncomplete(token) && (
                                      <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedToken(token);
                                            setIsUpdateModalOpen(true);
                                          }}
                                          className="absolute top-2 right-2 p-2 rounded-full bg-[var(--card-boarder)] hover:bg-[#444444] transition-colors duration-200"
                                      >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4 text-gray-400"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                        </svg>
                                      </button>
                                  )}
                              {token.logo && (
                                  <img
                                      src={token.logo || "/chats/noimg.svg"}
                                      alt={`${token.name} logo`}
                                      className="w-16 h-16 mr-3 sm:mr-4 rounded-lg"
                                  />
                              )}
                              <div>
                                <h3 className="text-xs sm:text-sm font-semibold text-white mb-1">
                                  {token.name}{" "}
                                  <span className="text-gray-400">
                            ({token.symbol})
                          </span>
                                </h3>
                                <p className="text-gray-400 text-[9px] sm:text-xs">
                                  {token.description}
                                </p>
                              </div>
                            </div>
                        ))}
                      </div>
                  ) : (
                      <p className="text-gray-400 text-center text-sm sm:text-base">
                        No tokens created
                      </p>
                  )}
                  {createdTokensTotalPages > 1 && (
                      <Pagination
                          currentPage={createdTokensPage}
                          totalPages={createdTokensTotalPages}
                          onPageChange={handleCreatedTokensPageChange}
                      />
                  )}
                </div>
            )}

          </div>

        </div>
        {isTokenLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <LoadingBar size="large"/>
            </div>
        )}
        {selectedToken && (
            <TokenUpdateModal
                token={selectedToken}
                isOpen={isUpdateModalOpen}
                onClose={() => {
                  setIsUpdateModalOpen(false);
                  setSelectedToken(null);
                }}
                onUpdate={handleTokenUpdate}
            />
        )}
      </Layout>
  );
};

export default ProfilePage;
