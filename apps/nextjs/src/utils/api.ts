// api.ts

import axios from 'axios';
import { Token, TokenWithLiquidityEvents, PaginatedResponse, LiquidityEvent, TokenWithTransactions, PriceResponse, HistoricalPrice, USDHistoricalPrice, TokenHolder, TransactionResponse } from '@/interface/types';
import { ethers } from 'ethers';
import { fetchTokenTransactions, fetchTokenPriceHistory, fetchRecentTokens, fetchTokenByAddress, fetchTokenLiquidityEvents } from './graphql';


export async function getAllTokens(page: number = 1, pageSize: number = 13): Promise<PaginatedResponse<Token>> {
  const response = await axios.get('/api/ports/getAllTokens', {
    params: { page, pageSize }
  });
  return response.data;
}

export async function getAllTokensTrends(): Promise<Token[]> {
  const response = await axios.get('/api/ports/getAllTokensTrends');
  return response.data;
}

export async function getAllTokensWithoutLiquidity(): Promise<Token[]> { //chewyswap aggregator use
  const response = await axios.get('/api/ports/getAllTokensWithoutLiquidity');
  return response.data;
}

//GET /api/volume/total
export async function getTotalVolume(): Promise<{ totalVolume: number }> {
  const response = await axios.get('/api/ports/getTotalVolume');
  return response.data;
}

//GET /api/volume/range?hours=24
export async function getVolumeRange(hours: number): Promise<{ totalVolume: number }> {
  const response = await axios.get('/api/ports/getVolumeRange', {
    params: { hours }
  });
  return response.data;
}

//GET /api/tokens/total-count
export async function getTotalTokenCount(): Promise<{ totalTokens: number }> {
  const response = await axios.get('/api/ports/getTotalTokenCount');
  return response.data;
}


export async function getRecentTokens(page: number = 1, pageSize: number = 20, hours: number = 24): Promise<PaginatedResponse<Token> | null> {
  try {
    // Use subgraph to fetch recent tokens (hours parameter is ignored as we fetch all tokens ordered by creation time)
    console.log('Fetching recent tokens from subgraph...');
    const result = await fetchRecentTokens(page, pageSize);
    
    if (result === null) {
      console.log('No recent tokens found in subgraph');
      return null;
    }
    
    console.log(`Successfully fetched ${result.data.length} tokens from subgraph`);
    return result;
  } catch (error) {
    console.error('Error fetching recent tokens from subgraph:', error);
    // Return null to match original API behavior on error
    return null;
  }
}

export async function searchTokens(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<Token>> {
  try {
    const response = await axios.get('/api/ports/searchTokens', {
      params: { q: query, page, pageSize }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching tokens:', error);
    throw new Error('Failed to search tokens');
  }
}

export async function getTokensWithLiquidity(page: number = 1, pageSize: number = 20): Promise<PaginatedResponse<TokenWithLiquidityEvents>> {
  const response = await axios.get('/api/ports/getTokensWithLiquidity', {
    params: { page, pageSize }
  });
  return response.data;
}

export async function getTokenByAddress(address: string): Promise<Token> {
  const response = await axios.get('/api/ports/getTokenByAddress', {
    params: { address }
  });
  return response.data;
}

export async function getTokenLiquidityEvents(tokenId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResponse<LiquidityEvent>> {
  try {
    console.log('Fetching liquidity events from subgraph for token:', tokenId);
    const result = await fetchTokenLiquidityEvents(tokenId, page, pageSize);
    
    // Transform the result to match the expected PaginatedResponse format
    return {
      data: result.liquidityEvents,
      totalCount: result.pagination.totalItems,
      currentPage: result.pagination.currentPage,
      totalPages: result.pagination.totalPages,
      tokens: [] // Legacy field, kept for compatibility
    };
  } catch (error) {
    console.error('Error fetching liquidity events from subgraph:', error);
    throw new Error(`Failed to fetch liquidity events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// New function that uses subgraph for token info
export async function getTokenInfoFromSubgraph(
  address: string
): Promise<Token> {
  try {
    console.log('Fetching token info from subgraph for address:', address);
    const tokenData = await fetchTokenByAddress(address);
    
    if (!tokenData) {
      throw new Error('Token not found in subgraph');
    }
    
    console.log('Successfully fetched token info from subgraph:', tokenData.name);
    return tokenData;
  } catch (error) {
    console.error('Error fetching token info from subgraph:', error);
    throw new Error(`Failed to fetch token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy function - still uses API for backward compatibility
export async function getTokenInfoAndTransactions(
  address: string,
  transactionPage: number = 1,
  transactionPageSize: number = 10
): Promise<TokenWithTransactions> {
  try {
    const baseUrl = typeof window === 'undefined' 
      ? process.env.NEXT_VERCEL_URL
        ? `https://${process.env.NEXT_VERCEL_URL}`
        : 'http://localhost:3000'
      : '';

    const response = await axios.get(`${baseUrl}/api/ports/getTokenInfoAndTransactions`, {
      params: { address, transactionPage, transactionPageSize }
    });
    return response.data;
  } catch (error) {
    console.error('Error in getTokenInfoAndTransactions:', error);
    throw error;
  }
}


// export async function getTokenInfoAndTransactions(
//   address: string,
//   transactionPage: number = 1,
//   transactionPageSize: number = 10
// ): Promise<any> {
//   try {
//     // First, try to get transactions from The Graph
//     let transactionData;
//     try {
//       transactionData = await fetchTokenTransactions(address, transactionPage, transactionPageSize);
//       console.log('Successfully fetched transactions from The Graph:', transactionData);
//     } catch (graphError) {
//       console.warn('Failed to fetch from The Graph, falling back to API:', graphError);
//       // Fallback to original API
      
//     }

//     // // Get token info from the original API (still needed for token metadata)
//     const baseUrl = typeof window === 'undefined' 
//       ? process.env.NEXT_VERCEL_URL
//         ? `https://${process.env.NEXT_VERCEL_URL}`
//         : 'http://localhost:3000'
//       : '';

//     const tokenResponse = await axios.get(`${baseUrl}/api/ports/getTokenByAddress`, {
//       params: { address }
//     });

//     // Combine token info with Graph transactions
//     return {
//       ...tokenResponse.data,
//       transactions: transactionData
//     };

//   } catch (error) {
//     console.error('Error in getTokenInfoAndTransactions:', error);
//     throw error;
//   }
// }


//historical price
export async function getHistoricalPriceData(address: string): Promise<Token> {
  const response = await axios.get('/api/ports/getHistoricalPriceData', {
    params: { address }
  });
  /*
        { tokenPrice: "2027375698647", timestamp: "2025-01-24T03:34:37.000Z" },
        { tokenPrice: "2031414327976", timestamp: "2025-01-24T03:42:59.000Z" },
        { tokenPrice: "2407224756148", timestamp: "2025-01-24T06:48:53.000Z" },
        { tokenPrice: "2721645394298", timestamp: "2025-01-24T13:30:49.000Z" },
        { tokenPrice: "2887445300856", timestamp: "2025-01-24T13:34:19.000Z" },
        { tokenPrice: "2916422130487", timestamp: "2025-01-24T15:34:52.000Z" },
  */
  return response.data;
}

//eth price usd - using CoinGecko API directly from frontend
export async function getCurrentPrice(): Promise<string> {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );

    const price = response.data.ethereum.usd.toString();
    console.log('Current ETH price in USD:', price);
    // { price: '112220.6034' }
    return price;
  } catch (error) {
    console.error('Error fetching ETH price from CoinGecko:', error);
    throw new Error('Failed to fetch ETH price');
  }
}


export async function getTokenUSDPriceHistory(address: string): Promise<USDHistoricalPrice[]> {
  try {
    // First, try to get price history from The Graph
    try {
      const ethPrice = await getCurrentPrice();
      console.log('Current ETH price in USD:', ethPrice);
      const graphPriceHistory = await fetchTokenPriceHistory(address);
      if (!graphPriceHistory || graphPriceHistory.length === 0) {
        console.warn('No price history found in The Graph for address:', address);
        throw new Error('No price history found');
      }
      
      console.log('Successfully fetched price history from The Graph:', graphPriceHistory.length, 'data points');
      
      // Convert ETH prices to USD
      return graphPriceHistory.map((price) => {
        const tokenPriceUSD = parseFloat(price.tokenPriceUSD) * parseFloat(ethPrice);
        return {
          tokenPriceUSD: tokenPriceUSD.toFixed(9),
          timestamp: price.timestamp
        };
      });
    } catch (graphError) {
      console.warn('Failed to fetch price history from The Graph, falling back to API:', graphError);
      
      // Fallback to original API
      const [ethPrice, historicalPrices] = await Promise.all([
        getCurrentPrice(),
        getHistoricalPriceData(address)
      ]);

      return historicalPrices.map((price: HistoricalPrice) => {
        const tokenPriceInWei = ethers.BigNumber.from(price.tokenPrice);
        const tokenPriceInETH = ethers.utils.formatEther(tokenPriceInWei);
        const tokenPriceUSD = parseFloat(tokenPriceInETH) * parseFloat(ethPrice);

        return {
          tokenPriceUSD: tokenPriceUSD.toFixed(9),  // Adjust decimal places as needed
          timestamp: price.timestamp
        };
      });
    }
  } catch (error) {
    console.error('Error calculating USD price history:', error);
    throw new Error('Failed to calculate USD price history');
  }
}


export async function updateToken(
  address: string, 
  data: {
    logo?: string;
    name?: string;
    symbol?: string;
    description?: string;
    website?: string;
    telegram?: string;
    discord?: string;
    twitter?: string;
    youtube?: string;
  }
): Promise<Token> {
  try {
    const response = await axios.patch('/api/ports/updateToken', {
      address,
      data
    });
    return response.data;
  } catch (error) {
    console.error('Error updating token:', error);
    throw new Error('Failed to update token');
  }
}

// get all transaction associated with a particular address
export async function getTransactionsByAddress(
  address: string, 
  page: number = 1, 
  pageSize: number = 10
): Promise<TransactionResponse> {
  try {
    const response = await axios.get('/api/ports/getTransactionsByAddress', {
      params: { address, page, pageSize }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw new Error('Failed to fetch transactions');
  }
}

// POST /chats: Add a new chat message with optional reply_to
export async function addChatMessage(
  user: string, 
  token: string, 
  message: string, 
  replyTo?: number
): Promise<{ id: number }> {
  try {
    const response = await axios.post('/api/ports/addChatMessage', {
      user,
      token,
      message,
      reply_to: replyTo  // Optional: ID of the message being replied to
    });
    return response.data;
  } catch (error) {
    console.error('Error adding chat message:', error);
    throw new Error('Failed to add chat message');
  }
}

// GET /chats: Get chat messages for a specific token
export async function getChatMessages(token: string): Promise<Array<{
  id: number;
  user: string;
  token: string;
  message: string;
  reply_to: number | null;
  timestamp: string;
}>> {
  try {
    const response = await axios.get('/api/ports/getChatMessages', {
      params: { token }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw new Error('Failed to fetch chat messages');
  }
}

//get all token address
export async function getAllTokenAddresses(): Promise<Array<{address: string, symbol: string}>> {
  try {
    const response = await axios.get('/api/ports/getAllTokenAddresses');
    return response.data;
  } catch (error) {
    console.error('Error fetching token addresses and symbols:', error);
    throw new Error('Failed to fetch token addresses and symbols');
  }
}

export async function getTokensByCreator(
  creatorAddress: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<Token>> {
  try {
    const response = await axios.get('/api/ports/getTokensByCreator', {
      params: { creatorAddress, page, pageSize }
    });
    // console.log('getTokensByCreator', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching tokens by creator:', error);
    throw new Error('Failed to fetch tokens by creator');
  }
}


//blockexplorer Get token Holders
export async function getTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    const response = await axios.get(`https://eth-sepolia.blockscout.com/api/v2/tokens/${tokenAddress}/holders`);
    const data = response.data;

    return data.items.map((item: any) => {
      return {
        address: item.address.hash,
        balance: item.value
      };
    });
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw new Error('Failed to fetch token holders');
  }
}
