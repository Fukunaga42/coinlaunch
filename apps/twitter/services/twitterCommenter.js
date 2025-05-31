const Token = require('../models/Token');
const XService = require('./XService');

class TwitterCommenterService {
    constructor() {
        // IMPORTANT: Pour poster des tweets, vous avez besoin d'OAuth 2.0 avec les scopes appropriés
        // Le Bearer token seul ne permet que de LIRE, pas de POSTER
        // Vous devez utiliser une librairie comme twitter-api-v2 avec OAuth 2.0
        // Exemple: npm install twitter-api-v2
        
        this.xService = null;
        this.isEnabled = false;
        
        try {
            this.xService = XService.getInstance();
            this.isEnabled = true;
            
            // Don't log OAuth status here - main.js will handle it
            if (XService.ShouldMock) {
                console.log('💬 Twitter Commenter Service initialized in MOCK mode');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Twitter Commenter Service:', error);
            console.warn('⚠️ Twitter commenting disabled');
            this.isEnabled = false;
        }
    }

    // Post a reply to a tweet
    async commentOnTweet(tokenId, tokenAddress) {
        if (!this.isEnabled) {
            console.warn('⚠️ Twitter commenting is disabled');
            return { success: false, error: 'Twitter commenting service not available' };
        }
        
        try {
            // Find the token in database
            const token = await Token.findById(tokenId);
            if (!token) {
                throw new Error('Token not found');
            }

            if (!token.xPostId) {
                throw new Error('No Twitter post ID associated with this token');
            }

            // Status is already set to COMMENTING by DBListenerService

            // Compose the comment - Twitter has 280 char limit
            // Worst case: name=32 chars, symbol=10 chars, address=42 chars
            let commentText = `🚀 ${token.name} ($${token.symbol}) deployed!\n\n` +
                               `📜 ${tokenAddress}\n\n` +
                               `🔍 eth-sepolia.blockscout.com/address/${tokenAddress}`;

            // Check length
            if (commentText.length > 280) {
                console.warn(`⚠️ Comment too long (${commentText.length} chars), truncating...`);
                // Fallback to shorter version
                const shortComment = `🚀 $${token.symbol} deployed!\n\n` +
                                   `🔍 eth-sepolia.blockscout.com/address/${tokenAddress}`;
                commentText = shortComment;
            }

            console.log(`💬 Posting comment for token ${token.name} (${commentText.length} chars)...`);
            
            // Post the reply
            const replyOptions = {
                text: commentText,
                reply: {
                    in_reply_to_tweet_id: token.xPostId
                }
            };

            const result = await this.xService.replyToTweet(replyOptions);
            
            if (result.error) {
                throw new Error(result.error);
            }

            // Update token status to COMMENTED
            await Token.findByIdAndUpdate(tokenId, { 
                status: 'COMMENTED',
                commentedAt: new Date(),
                commentTweetId: result.data?.id || 'mock_comment_id'
            });

            console.log(`✅ Comment posted successfully${XService.ShouldMock ? ' (MOCK)' : ''}`);
            return { 
                success: true, 
                commentId: result.data?.id,
                isMock: XService.ShouldMock
            };

        } catch (error) {
            console.error('❌ Error commenting on tweet:', error);
            
            // Update status to COMMENT_FAILED
            await Token.findByIdAndUpdate(tokenId, { 
                status: 'COMMENT_FAILED',
                processingError: error.message
            });

            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // This method won't work with Bearer token - needs OAuth
    async postReply(inReplyToTweetId, text) {
        throw new Error('This method requires OAuth implementation with twitter-api-v2');
    }
}

module.exports = TwitterCommenterService; 