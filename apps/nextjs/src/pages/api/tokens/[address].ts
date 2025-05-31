import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface TokenResponse {
    address: string;
    logo: string | null;
    symbol: string;
    name: string;
}

interface ErrorResponse {
    error: string;
    details?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    console.log('[DEBUG] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    console.log('[DEBUG] Invalid address:', address);
    return res.status(400).json({ error: 'Valid token address is required' });
  }

  try {
    // First try the primary backend API endpoint
    console.log('[DEBUG] Requesting primary endpoint:', `${API_BASE_URL}/api/tokens/${address}`);
    const response = await axios.get(`${API_BASE_URL}/api/tokens/${address}`);
    
    // Return the token data
    return res.status(200).json(response.data);
  } catch (primaryError: any) {
    console.log('[DEBUG] Primary endpoint failed, trying alternative endpoint');
    
    try {
      // Fallback to alternative backend API endpoint
      const fallbackUrl = `${API_BASE_URL}/api/tokens/address/${address}`;
      console.log('[DEBUG] Requesting fallback endpoint:', fallbackUrl);
      
      const fallbackResponse = await axios.get<TokenResponse>(fallbackUrl);
      return res.status(200).json(fallbackResponse.data);
    } catch (fallbackError: any) {
      console.error('[ERROR] Both endpoints failed:', {
        primary: primaryError.message,
        fallback: fallbackError.message
      });
      
      // Return 404 if both endpoints return 404
      if (primaryError.response?.status === 404 && fallbackError.response?.status === 404) {
        return res.status(404).json({ error: 'Token not found' });
      }
      
      // Return 500 for other errors
      return res.status(500).json({ 
        error: 'Failed to fetch token',
        details: fallbackError.response?.data || fallbackError.message 
      });
    }
  }
}
