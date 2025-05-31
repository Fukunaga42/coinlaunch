import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const backendResponse = await axios.get(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/privy`,
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    res.status(200).json(backendResponse.data);
  } catch (error) {
    console.error("Backend call failed:", error);
    res.status(400).json({ error: "Backend call failed" });
  }
}
