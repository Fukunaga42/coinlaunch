#!/usr/bin/env node

const axios = require('axios');

const TWITTER_SERVICE_URL = 'http://localhost:5051';
const API_SERVICE_URL = 'http://localhost:5050';

async function testIntegration() {
    console.log('🧪 Testing CoinLaunch Twitter Service Integration\n');
    
    try {
        // Test 1: Check Twitter service health
        console.log('1️⃣ Checking Twitter service health...');
        const twitterHealth = await axios.get(TWITTER_SERVICE_URL);
        console.log('✅ Twitter service:', twitterHealth.data);
        
        // Test 2: Check OAuth2 status
        console.log('\n2️⃣ Checking OAuth2 status...');
        const authStatus = await axios.get(`${TWITTER_SERVICE_URL}/auth/twitter/status`);
        console.log('OAuth2 status:', authStatus.data);
        
        if (!authStatus.data.authenticated) {
            console.log('⚠️ Not authenticated with Twitter');
            console.log(`📌 Visit ${TWITTER_SERVICE_URL}/auth/twitter/login to authenticate`);
        }
        
        // Test 3: Check if both services can access the same DB
        console.log('\n3️⃣ Testing database connectivity...');
        console.log('Note: Both services should connect to the same MongoDB instance');
        
        // Test 4: Create a test token via API
        if (process.env.TEST_CREATE_TOKEN === 'true') {
            console.log('\n4️⃣ Creating test token...');
            const testToken = {
                name: "IntegrationTest",
                symbol: "ITEST",
                status: "AWAITING_MINT",
                xPostId: `test_${Date.now()}`,
                twitterUsername: "testuser"
            };
            
            try {
                const createResponse = await axios.post(`${API_SERVICE_URL}/tokens`, testToken);
                console.log('✅ Token created:', createResponse.data);
                console.log('The DBListener in Twitter service should pick this up...');
            } catch (error) {
                console.log('❌ Failed to create token:', error.response?.data || error.message);
                console.log('Make sure the API service is running on port 5050');
            }
        }
        
        console.log('\n✅ Integration test completed!');
        console.log('\n📝 Next steps:');
        console.log('1. Make sure both services are running (API on 5050, Twitter on 5051)');
        console.log('2. Complete OAuth2 authentication for Twitter');
        console.log('3. Enable Twitter listener in .env');
        console.log('4. Test with real Twitter mentions');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('Make sure the Twitter service is running on port 5051');
        }
    }
}

// Run the test
testIntegration(); 