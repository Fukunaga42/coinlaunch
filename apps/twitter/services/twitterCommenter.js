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
            
            // Log the commenting service status
            if (XService.ShouldMock) {
                console.log('💬 Twitter Commenter Service initialized in MOCK mode');
            } else if (!this.xService.isUserAuthenticated()) {
                console.warn('⚠️ Twitter Commenter Service: OAuth2 not authenticated');
                console.log('📌 Please visit /api/twitter/login to authenticate');
            } else {
                console.log('✅ Twitter Commenter Service ready to post real comments');
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

            // Update status to COMMENTING
            await Token.findByIdAndUpdate(tokenId, { status: 'COMMENTING' });

            // Compose the comment
            const commentText = `🚀 Your token ${token.name} ($${token.symbol}) has been deployed!\n\n` +
                               `Contract: ${tokenAddress}\n` +
                               `View on Etherscan: https://etherscan.io/token/${tokenAddress}\n\n` +
                               `Start trading now! 💎`;

            console.log(`💬 Posting comment for token ${token.name}...`);
            
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