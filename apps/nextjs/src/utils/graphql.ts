import { GraphQLClient, gql } from 'graphql-request';
import { parseUnits, formatUnits } from 'viem';
import { Transaction, Token, PaginatedResponse } from '@/interface/types';

// The Graph endpoint
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/112829/coinlaunch-bonding/version/latest';

// Create GraphQL client
const graphqlClient = new GraphQLClient(SUBGRAPH_URL);

// TypeScript interfaces for subgraph responses
export interface SubgraphTransaction {
  id: string;
  hash: string;
  type: 'CREATE' | 'BUY' | 'SELL' | 'GRADUATE';
  user: string;
  ethAmount: string;
  tokenAmount: string;
  timestamp: string;
  blockNumber: string;
}

export interface SubgraphTransactionsResponse {
  transactions: SubgraphTransaction[];
}

export interface SubgraphTransactionCountResponse {
  transactions: { id: string }[];
}

export interface SubgraphTokenPriceMinute {
  tokenPrice: string;
  timestamp: string;
}

export interface SubgraphPriceHistoryResponse {
  tokenPriceMinutes: SubgraphTokenPriceMinute[];
}

export interface SubgraphToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  creator: string;
  createdAt: string;
  totalVolume: string;
  totalSupply: string;
  isGraduated: boolean;
}

export interface SubgraphTokensResponse {
  tokens: SubgraphToken[];
}

export interface SubgraphTokenCountResponse {
  tokens: { id: string }[];
}

export interface SubgraphTokenResponse {
  token: SubgraphToken | null;
}

// GraphQL queries
const GET_TOKEN_TRANSACTIONS = gql`
  query GetTokenTransactions($tokenAddress: Bytes!, $first: Int!, $skip: Int!) {
    transactions(
      where: { token: $tokenAddress }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      hash
      type
      user
      ethAmount
      tokenAmount
      timestamp
      blockNumber
    }
  }
`;

const GET_TOKEN_TRANSACTION_COUNT = gql`
  query GetTokenTransactionCount($tokenAddress: Bytes!) {
    transactions(where: { token: $tokenAddress }) {
      id
    }
  }
`;

const GET_RECENT_TOKENS = gql`
  query GetRecentTokens($first: Int!, $skip: Int!) {
    tokens(
      orderBy: createdAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      address
      name
      symbol
      creator
      createdAt
      totalVolume
      totalSupply
      isGraduated
    }
  }
`;

const GET_TOKEN_COUNT = gql`
  query GetTokenCount {
    tokens {
      id
    }
  }
`;

const GET_TOKEN_BY_ADDRESS = gql`
  query GetTokenByAddress($address: Bytes!) {
    token(id: $address) {
      id
      address
      name
      symbol
      creator
      createdAt
      totalVolume
      totalSupply
      isGraduated
    }
  }
`;

// Helper function to convert decimal string to wei string
function convertDecimalToWei(decimalString: string, decimals: number = 18): string {
  try {
    // If the string is already in wei format (no decimal point), return as is
    if (!decimalString.includes('.')) {
      return decimalString;
    }
    
    // Parse the decimal and convert to wei
    const decimalValue = parseFloat(decimalString);
    if (isNaN(decimalValue)) {
      return '0';
    }
    
    // Convert to wei using parseUnits
    const weiValue = parseUnits(decimalString, decimals);
    return weiValue.toString();
  } catch (error) {
    console.warn('Error converting decimal to wei:', decimalString, error);
    return '0';
  }
}

// Transform subgraph token to app token format
export function transformSubgraphToken(subgraphToken: SubgraphToken): Token {
  return {
    map: null,
    id: subgraphToken.id,
    chainId: 11155111, // Sepolia chain ID
    address: subgraphToken.address,
    creatorAddress: subgraphToken.creator,
    name: subgraphToken.name,
    symbol: subgraphToken.symbol,
    logo: '',
    description: '',
    createdAt: (parseInt(subgraphToken.createdAt) * 1000).toString(), // Convert to milliseconds string
    updatedAt: (parseInt(subgraphToken.createdAt) * 1000).toString(),
    website: '',
    youtube: '',
    discord: '',
    twitter: '',
    telegram: '',
    latestTransactionTimestamp: subgraphToken.createdAt,
    _count: {
      liquidityEvents: 0
    }
  };
}

// Transform subgraph transaction to app transaction format
export function transformSubgraphTransaction(subgraphTx: SubgraphTransaction): Transaction {
  return {
    id: subgraphTx.id,
    txHash: subgraphTx.hash,
    type: subgraphTx.type.toLowerCase(), // Convert to lowercase to match current format
    senderAddress: subgraphTx.user,
    recipientAddress: '', // Not available in subgraph, set empty
    ethAmount: convertDecimalToWei(subgraphTx.ethAmount, 18), // Convert ETH amount to wei
    tokenAmount: convertDecimalToWei(subgraphTx.tokenAmount, 18), // Convert token amount to wei
    tokenPrice: '0', // Will need to calculate this if needed
    timestamp: (parseInt(subgraphTx.timestamp) * 1000).toString(), // Convert to milliseconds string
  };
}

// Fetch transactions with pagination
export async function fetchTokenTransactions(
  tokenAddress: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  transactions: Transaction[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}> {
  try {
    const skip = (page - 1) * limit;
    
    // Fetch transactions and count in parallel
    const [transactionsResponse, countResponse] = await Promise.all([
      graphqlClient.request<SubgraphTransactionsResponse>(GET_TOKEN_TRANSACTIONS, {
        tokenAddress: tokenAddress.toLowerCase(),
        first: limit,
        skip: skip,
      }),
      graphqlClient.request<SubgraphTransactionCountResponse>(GET_TOKEN_TRANSACTION_COUNT, {
        tokenAddress: tokenAddress.toLowerCase(),
      }),
    ]);

    const totalItems = countResponse.transactions.length;
    const totalPages = Math.ceil(totalItems / limit);

    // Transform transactions to match current format
    const transformedTransactions = transactionsResponse.transactions.map(transformSubgraphTransaction);

    return {
      transactions: transformedTransactions,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
    };
  } catch (error) {
    console.error('Error fetching transactions from The Graph:', error);
    throw new Error(`Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// GraphQL query for token price history
const GET_TOKEN_PRICE_HISTORY = gql`
  query GetTokenPriceHistory($tokenAddress: Bytes!) {
    tokenPriceMinutes(
      where: { token: $tokenAddress }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      tokenPrice
      timestamp
    }
  }
`;

// Fetch token price history from The Graph
export async function fetchTokenPriceHistory(
  tokenAddress: string
): Promise<Array<{ tokenPriceUSD: string; timestamp: string }>> {
  try {
    const response = await graphqlClient.request<SubgraphPriceHistoryResponse>(
      GET_TOKEN_PRICE_HISTORY,
      {
        tokenAddress: tokenAddress.toLowerCase(),
      }
    );

    // Transform the data to match the expected format
    return response.tokenPriceMinutes.map((item) => ({
      tokenPriceUSD: formatUnits(BigInt(item.tokenPrice), 18), // Convert wei to ETH
      timestamp: new Date(parseInt(item.timestamp) * 1000).toISOString(), // Convert to ISO string
    }));
  } catch (error) {
    console.error('Error fetching price history from The Graph:', error);
    throw new Error(`Failed to fetch price history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fetch a single token by address from The Graph
export async function fetchTokenByAddress(
  tokenAddress: string
): Promise<Token | null> {
  try {
    const response = await graphqlClient.request<SubgraphTokenResponse>(GET_TOKEN_BY_ADDRESS, {
      address: tokenAddress.toLowerCase(),
    });

    if (!response.token) {
      console.log('Token not found in subgraph:', tokenAddress);
      return null;
    }

    // Transform token to match current format
    const transformedToken = transformSubgraphToken(response.token);
    console.log('Successfully fetched token from subgraph:', transformedToken.name);
    return transformedToken;
  } catch (error) {
    console.error('Error fetching token from The Graph:', error);
    throw new Error(`Failed to fetch token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fetch recent tokens with pagination from The Graph
export async function fetchRecentTokens(
  page: number = 1,
  limit: number = 100
): Promise<PaginatedResponse<Token> | null> {
  try {
    const skip = (page - 1) * limit;
    
    // Fetch tokens and count in parallel
    const [tokensResponse, countResponse] = await Promise.all([
      graphqlClient.request<SubgraphTokensResponse>(GET_RECENT_TOKENS, {
        first: limit,
        skip: skip,
      }),
      graphqlClient.request<SubgraphTokenCountResponse>(GET_TOKEN_COUNT),
    ]);

    const totalItems = countResponse.tokens.length;
    const totalPages = Math.ceil(totalItems / limit);

    // Transform tokens to match current format
    const transformedTokens = tokensResponse.tokens.map(transformSubgraphToken);

    // Return null if no tokens found (to match original API behavior)
    if (transformedTokens.length === 0 && page === 1) {
      return null;
    }

    return {
      data: transformedTokens,
      totalCount: totalItems,
      currentPage: page,
      totalPages: totalPages,
      tokens: [] // Legacy field, kept for compatibility
    };
  } catch (error) {
    console.error('Error fetching recent tokens from The Graph:', error);
    throw new Error(`Failed to fetch recent tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Health check function to test The Graph connectivity
export async function checkSubgraphHealth(): Promise<boolean> {
  try {
    const testQuery = gql`
      query HealthCheck {
        transactions(first: 1) {
          id
        }
      }
    `;
    
    await graphqlClient.request(testQuery);
    return true;
  } catch (error) {
    console.error('Subgraph health check failed:', error);
    return false;
  }
}
