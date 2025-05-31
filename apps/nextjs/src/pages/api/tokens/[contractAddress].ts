import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface TokenResponse {
    address: string;
    logo: string | null;
    symbol: string;
    name: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TokenResponse | { error: string }>
) {
    if (req.method !== 'GET') {
        console.log('[DEBUG] Method not allowed:', req.method);
        return res.status(405).end(); // Method Not Allowed
    }

    const { contractAddress } = req.query;

    if (!contractAddress || typeof contractAddress !== 'string') {
        console.log('[DEBUG] Invalid contract address:', contractAddress);
        return res.status(400).json({ error: 'Valid contract address is required in the query string.' });
    }

    try {
        const url = `${API_BASE_URL}/api/tokens/address/${contractAddress}`;
        console.log('[DEBUG] Requesting pako:', url);

        const response = await axios.get<TokenResponse>(url);

        return res.status(200).json(response.data);
    } catch (error: any) {
        console.error('[ERROR] Failed to fetch token by address:', error.message);

        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Token not found for provided contract address' });
        }

        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
