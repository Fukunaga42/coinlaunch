import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { Token, PaginatedResponse } from '@/interface/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PaginatedResponse<Token>>
) {
  if (req.method !== 'GET') {
    console.log('[DEBUG] Method not allowed:', req.method);
    return res.status(405).end();
  }

  try {
    const { creatorAddress, page = 1, pageSize = 20 } = req.query;

    console.log('[DEBUG] Incoming request query:', req.query);

    if (!creatorAddress || typeof creatorAddress !== 'string') {
      console.log('[DEBUG] Invalid creatorAddress:', creatorAddress);
      return res.status(400).json({
        tokens: [],
        data: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 1
      });
    }

    const url = `${API_BASE_URL}/api/tokens/creator/${creatorAddress}`;
    const params = { page: Number(page), pageSize: Number(pageSize) };

    console.log('[DEBUG] Requesting external API:', url, params);

    const response = await axios.get(url, { params });

    console.log('[DEBUG] External API response:', response.data);

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('[ERROR] API handler failed:', error?.message);
    if (error?.response) {
      console.error('[ERROR] External API response:', error.response.data);
    } else {
      console.error('[ERROR] Stack trace:', error?.stack);
    }

    res.status(500).json({
      tokens: [],
      data: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1
    });
  }
}
