require("dotenv").config();
const mongoose = require('mongoose');
const { connectDB } = require('./services/db');
const Token = require('./models/Token');
const EscrowWallet = require('./models/EscrowWallet');

async function testSystem() {
    console.log('🧪 Starting system test...\n');
    
    // Connect to DB
    await connectDB();
    
    // Test 1: Check environment variables
    console.log('1️⃣ Checking environment variables...');
    const requiredEnvVars = [
        'MONGO_URI',
        'ETH_RPC_URL',
        'BONDING_CURVE_MANAGER_ADDRESS',
        'ESCROW_ENCRYPTION_KEY',
        'FUNDING_PRIVATE_KEY',
        'X_CLIENT_ID',
        'X_CLIENT_SECRET',
        'X_OAUTH_2_REDIRECT_URL',
        'USER_X_ID'
    ];
    
    // Check for either X_APP_BEARER_TOKEN or TWITTER_BEARER_TOKEN
    const bearerTokenExists = process.env.X_APP_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    
    let envOk = true;
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            console.error(`❌ Missing: ${envVar}`);
            envOk = false;
        } else {
            console.log(`✅ Found: ${envVar}`);
        }
    }
    
    if (!bearerTokenExists) {
        console.error('❌ Missing: X_APP_BEARER_TOKEN or TWITTER_BEARER_TOKEN');
        envOk = false;
    } else {
        console.log('✅ Found: Bearer Token (X_APP_BEARER_TOKEN or TWITTER_BEARER_TOKEN)');
    }
    
    if (!envOk) {
        console.error('\n❌ Missing required environment variables!');
        process.exit(1);
    }
    
    // Test 2: Database connection
    console.log('\n2️⃣ Testing database...');
    try {
        const count = await Token.countDocuments();
        console.log(`✅ Database connected. Found ${count} tokens.`);
    } catch (error) {
        console.error('❌ Database error:', error.message);
        process.exit(1);
    }
    
    // Test 3: Escrow wallet encryption
    console.log('\n3️⃣ Testing escrow wallet encryption...');
    try {
        const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const encrypted = EscrowWallet.encryptPrivateKey(testPrivateKey);
        const decrypted = EscrowWallet.decryptPrivateKey(encrypted);
        
        if (decrypted === testPrivateKey) {
            console.log('✅ Encryption/decryption working correctly');
        } else {
            throw new Error('Encryption/decryption mismatch');
        }
    } catch (error) {
        console.error('❌ Encryption error:', error.message);
    }
    
    // Test 4: Check services
    console.log('\n4️⃣ Testing services initialization...');
    try {
        const XService = require('./services/XService');
        const xService = XService.getInstance();
        console.log(`✅ XService initialized. OAuth2 authenticated: ${xService.isUserAuthenticated()}`);
        console.log(`   Mock mode: ${XService.ShouldMock ? 'ENABLED' : 'DISABLED'}`);
        
        const TokenMinterService = require('./services/tokenMinter');
        const minter = new TokenMinterService();
        console.log(`✅ TokenMinterService initialized. Configured: ${minter.isConfigured}`);
        
        const EscrowWalletService = require('./services/escrowWalletService');
        const escrowService = new EscrowWalletService();
        console.log(`✅ EscrowWalletService initialized. Configured: ${escrowService.isConfigured}`);
        
        // Check if funding wallet has balance
        if (process.env.FUNDING_PRIVATE_KEY && process.env.ETH_RPC_URL) {
            try {
                const { ethers } = require('ethers');
                const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
                const fundingWallet = new ethers.Wallet(process.env.FUNDING_PRIVATE_KEY, provider);
                const balance = await provider.getBalance(fundingWallet.address);
                console.log(`💰 Funding wallet balance: ${ethers.utils.formatEther(balance)} ETH`);
                if (balance.eq(0)) {
                    console.warn('⚠️ Funding wallet has no ETH! Please fund it before minting.');
                }
            } catch (error) {
                console.error('❌ Error checking funding wallet:', error.message);
            }
        }
    } catch (error) {
        console.error('❌ Service initialization error:', error.message);
    }
    
    // Test 5: Check token statuses
    console.log('\n5️⃣ Checking token statuses...');
    try {
        const statusCounts = await Token.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        console.log('Token status distribution:');
        statusCounts.forEach(status => {
            console.log(`  ${status._id || 'NO_STATUS'}: ${status.count}`);
        });
        
        // Check for stuck tokens
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const stuckTokens = await Token.find({
            status: 'MINTING',
            updatedAt: { $lt: fiveMinutesAgo }
        });
        
        if (stuckTokens.length > 0) {
            console.warn(`⚠️ Found ${stuckTokens.length} tokens stuck in MINTING status`);
            stuckTokens.forEach(token => {
                console.warn(`   - ${token.name} (${token.symbol}) - ID: ${token._id}`);
            });
        }
    } catch (error) {
        console.error('❌ Error checking token statuses:', error.message);
    }
    
    // Test token extraction
    console.log('\n🧪 Testing token extraction...');
    try {
        const XService = require('./services/XService');
        const xService = XService.getInstance();
        
        const validTweet = {
            data: {
                id: 'test_tweet_123',
                text: '@coinlaunchnow $TestToken $TEST',
                author_id: 'test_user_123'
            }
        };
        
        const extraction = xService.extractTokenData(validTweet.data.text);
        console.log('Token extraction result:', extraction);
        
        // Test invalid formats
        console.log('\n🧪 Testing invalid formats...');
        const invalidFormats = [
            '@coinlaunchnow $Test',  // Missing symbol
            '@coinlaunchnow $T $T',    // Too short name
            '@coinlaunchnow $Test!Token $TEST',  // Invalid characters
            '@coinlaunchnow $TestToken $VERYLONGSYMBOL',  // Symbol too long
        ];
        
        invalidFormats.forEach(text => {
            const result = xService.extractTokenData(text);
            console.log(`Format "${text}" - ${result.success ? '✅' : `❌ ${result.error}`}`);
        });
    } catch (error) {
        console.error('❌ Error testing token extraction:', error.message);
    }
    
    console.log('\n✅ System test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Complete OAuth2 flow: http://localhost:5051/auth/twitter/login');
    console.log('2. Enable Twitter listener: ENABLE_TWITTER_LISTENER=true');
    console.log('3. Fund your funding wallet with ETH');
    console.log('4. Test with a real tweet: @coinlaunchnow $YourToken $SYMBOL');
    console.log('5. For testing without API calls, set XService.ShouldMock = true');
    
    process.exit(0);
}

// Run test
testSystem().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 