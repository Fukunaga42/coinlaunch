import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Valid token address is required' });
  }

  try {
    // Call our backend API
    const response = await axios.get(`${API_BASE_URL}/api/tokens/${address}`);
    
    // Return the token data
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error fetching token from backend:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch token',
      details: error.response?.data || error.message 
    });
  }
} 