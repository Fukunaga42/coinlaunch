const Token = require('../models/Token');
const TokenMinterService = require('./tokenMinter');
const TwitterCommenterService = require('./twitterCommenter');
const { ethers } = require('ethers');

class DBListenerService {
    constructor(tokenMinter = null, twitterCommenter = null) {
        // Use provided services or create new ones
        this.tokenMinter = tokenMinter || new TokenMinterService();
        this.twitterCommenter = twitterCommenter || new TwitterCommenterService();
        
        this.isRunning = false;
        this.intervalId = null;
        this.pollingInterval = parseInt(process.env.DB_POLLING_INTERVAL) || 1000; // 1 seconds default
        
        // Initialize provider for on-chain checks
        if (process.env.ETH_RPC_URL) {
            this.provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
        }
        
        console.log('🔄 DBListenerService initialized');
    }

    // Start listening to database changes
    start() {
        if (this.isRunning) {
            console.log('⚠️ DBListenerService is already running');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Starting DBListenerService...');
        
        // Start polling
        this.intervalId = setInterval(() => {
            this.checkForPendingTokens();
        }, this.pollingInterval);

        // Check immediately on start
        this.checkForPendingTokens();
    }

    // Stop listening
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('🛑 DBListenerService stopped');
    }

    // Check for tokens that need processing
    async checkForPendingTokens() {
        try {
            // Find tokens awaiting mint
            const tokensToMint = await Token.find({ status: 'AWAITING_MINT' })
                .sort({ createdAt: 1 }) // Process oldest first
                .limit(5); // Process max 5 at a time

            if (tokensToMint.length > 0) {
                console.log(`🔍 Found ${tokensToMint.length} tokens awaiting mint`);
                
                for (const token of tokensToMint) {
                    await this.processToken(token);
                }
            }

            // Check tokens that are MINTING (verify on-chain status)
            const tokensInMinting = await Token.find({ 
                status: 'MINTING',
                mintTransactionHash: { $exists: true, $ne: null }
            });

            if (tokensInMinting.length > 0 && this.provider) {
                console.log(`🔍 Checking ${tokensInMinting.length} tokens with MINTING status`);
                
                for (const token of tokensInMinting) {
                    await this.checkOnChainStatus(token);
                }
            }

            // Find tokens that are MINTED but not yet set to COMMENTING
            const tokensToSetCommenting = await Token.find({ 
                status: 'MINTED',
                address: { $exists: true, $ne: null }
            })
            .sort({ createdAt: 1 })
            .limit(5);

            if (tokensToSetCommenting.length > 0) {
                console.log(`🔍 Found ${tokensToSetCommenting.length} tokens ready for commenting`);
                
                for (const token of tokensToSetCommenting) {
                    // Update status to COMMENTING before calling the commenter
                    await Token.findByIdAndUpdate(token._id, { status: 'COMMENTING' });
                    await this.commentOnToken(token);
                }
            }

        } catch (error) {
            console.error('❌ Error in DBListenerService:', error);
        }
    }

    // Check on-chain status of a minting transaction
    async checkOnChainStatus(token) {
        try {
            if (!token.mintTransactionHash || !this.provider) {
                return;
            }

            console.log(`🔍 Checking on-chain status for ${token.name} (tx: ${token.mintTransactionHash})`);
            
            const receipt = await this.provider.getTransactionReceipt(token.mintTransactionHash);
            
            if (receipt) {
                if (receipt.status === 1) {
                    // Transaction succeeded - already handled by tokenMinter
                    console.log(`✅ Transaction confirmed for ${token.name}`);
                } else {
                    // Transaction failed
                    console.log(`❌ Transaction failed for ${token.name}`);
                    await Token.findByIdAndUpdate(token._id, {
                        status: 'FAILED',
                        processingError: 'Mint transaction failed on-chain'
                    });
                }
            }
            // If no receipt yet, transaction is still pending - will check again next poll
            
        } catch (error) {
            console.error(`❌ Error checking on-chain status for token ${token._id}:`, error);
        }
    }

    // Process a single token (mint it)
    async processToken(token) {
        try {
            console.log(`⚙️ Processing token: ${token.name} (${token.symbol})`);
            
            // Call minter service
            const result = await this.tokenMinter.mintToken({
                tokenId: token._id.toString(),
                name: token.name,
                symbol: token.symbol,
                imageUrl: token.tokenImageUrl,
                xPostId: token.xPostId
            });

            if (!result.success) {
                console.error(`❌ Failed to mint ${token.name}: ${result.error}`);
            }

        } catch (error) {
            console.error(`❌ Error processing token ${token._id}:`, error);
        }
    }

    // Comment on a minted token
    async commentOnToken(token) {
        try {
            console.log(`💬 Commenting on token: ${token.name}`);
            
            // Call twitter commenter service
            const result = await this.twitterCommenter.commentOnTweet(
                token._id.toString(),
                token.address
            );

            if (!result.success) {
                console.error(`❌ Failed to comment on ${token.name}: ${result.error}`);
            }

        } catch (error) {
            console.error(`❌ Error commenting on token ${token._id}:`, error);
        }
    }
}

module.exports = DBListenerService; 