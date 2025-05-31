const axios = require('axios');
const Token = require('../models/Token');
const { uploadToIPFS } = require('./ipfsUploader');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { ethers } = require('ethers');
const EscrowWalletService = require('./escrowWalletService');

class TokenMinterService {
    constructor() {
        this.isConfigured = false;
        this.provider = null;
        this.bondingCurveManagerAddress = null;
        this.escrowWalletService = null;
        
        // Check if required environment variables are present
        if (!process.env.ETH_RPC_URL) {
            console.warn('⚠️ ETH_RPC_URL not set - minting service will not work');
            console.warn('⚠️ To enable: Set ETH_RPC_URL in your .env file');
            return;
        }
        
        if (!process.env.BONDING_CURVE_MANAGER_ADDRESS) {
            console.warn('⚠️ BONDING_CURVE_MANAGER_ADDRESS not set - minting service will not work');
            console.warn('⚠️ To enable: Deploy the bonding curve manager contract and set its address');
            return;
        }
        
        if (!process.env.FUNDING_PRIVATE_KEY) {
            console.warn('⚠️ FUNDING_PRIVATE_KEY not set - escrow wallets cannot be funded');
            console.warn('⚠️ To enable: Set a private key for the funding wallet with ETH');
        }
        
        try {
            this.provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
            this.bondingCurveManagerAddress = process.env.BONDING_CURVE_MANAGER_ADDRESS;
            this.bondingCurveManagerABI = require('../abi/BondingCurveManager.json');
            this.escrowWalletService = new EscrowWalletService();
            this.isConfigured = true;
            
            // Check if we're on a testnet or mainnet
            this.provider.getNetwork().then(network => {
                const networkName = network.name === 'homestead' ? 'mainnet' : network.name;
                console.log(`✅ TokenMinterService configured on ${networkName} (chainId: ${network.chainId})`);
            }).catch(err => {
                console.error('❌ Error getting network info:', err);
            });
            
        } catch (error) {
            console.error('❌ Error configuring TokenMinterService:', error);
            this.isConfigured = false;
        }
    }

    // Download image from URL
    async downloadImage(imageUrl, filename) {
        try {
            const response = await axios.get(imageUrl, { responseType: 'stream' });
            const tempPath = path.join('downloaded_files', filename);
            
            // Ensure directory exists
            await fsPromises.mkdir('downloaded_files', { recursive: true });
            
            // Save image to temp file
            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(tempPath));
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('Error downloading image:', error);
            throw error;
        }
    }

    // Fund escrow wallet for gas fees
    async fundEscrowWallet(escrowAddress, requiredAmount) {
        try {
            // Check if funding wallet is configured
            if (!process.env.FUNDING_PRIVATE_KEY) {
                throw new Error('FUNDING_PRIVATE_KEY not configured - cannot fund escrow wallets');
            }
            
            const fundingWallet = new ethers.Wallet(process.env.FUNDING_PRIVATE_KEY, this.provider);
            
            // Add buffer for gas variations
            const amountWithBuffer = requiredAmount.mul(120).div(100); // 20% buffer
            
            console.log(`💸 Funding escrow wallet ${escrowAddress} with ${ethers.utils.formatEther(amountWithBuffer)} ETH`);
            
            const tx = await fundingWallet.sendTransaction({
                to: escrowAddress,
                value: amountWithBuffer
            });
            
            await tx.wait();
            console.log(`✅ Escrow wallet funded: ${tx.hash}`);
            
        } catch (error) {
            console.error('Error funding escrow wallet:', error);
            throw error;
        }
    }

    // Mint token on Ethereum
    async mintToken(tokenData) {
        if (!this.isConfigured) {
            const error = 'TokenMinterService is not configured. Please set ETH_RPC_URL and BONDING_CURVE_MANAGER_ADDRESS';
            console.error('❌', error);
            return { success: false, error };
        }
        
        const { tokenId, name, symbol, imageUrl, xPostId } = tokenData;
        
        console.log(`🏗️ Starting mint process for ${name} (${symbol})`);
        
        try {
            // Get token from database to find the Twitter username
            const token = await Token.findById(tokenId);
            if (!token || !token.twitterUsername) {
                throw new Error('Token or Twitter username not found');
            }
            
            // Update status to MINTING
            await Token.findByIdAndUpdate(tokenId, { status: 'MINTING' });
            
            // Get or create escrow wallet for the Twitter user
            const escrowAddress = await this.escrowWalletService.getOrCreateEscrowWallet(token.twitterUsername);
            const escrowWallet = await this.escrowWalletService.getEscrowWalletInstance(token.twitterUsername);
            
            console.log(`🔐 Using escrow wallet for @${token.twitterUsername}: ${escrowAddress}`);
            
            // Download and upload image to IPFS
            let ipfsImageUrl = '';
            if (imageUrl) {
                try {
                    const imagePath = await this.downloadImage(imageUrl, `${tokenId}.jpg`);
                    const ipfsResult = await uploadToIPFS(imagePath, `${name}-logo.jpg`);
                    ipfsImageUrl = ipfsResult.url;
                    
                    // Clean up temp file
                    await fsPromises.unlink(imagePath);
                    console.log(`📷 Image uploaded to IPFS: ${ipfsImageUrl}`);
                } catch (error) {
                    console.warn('⚠️ Failed to upload image to IPFS:', error.message);
                    // Continue without image
                }
            }
            
            // Create contract instance with escrow wallet
            const bondingCurveManager = new ethers.Contract(
                this.bondingCurveManagerAddress,
                this.bondingCurveManagerABI,
                escrowWallet // Use escrow wallet instead of server wallet
            );
            
            // Estimate gas for the transaction
            const estimatedGas = await bondingCurveManager.estimateGas.create(
                name,
                symbol,
                { value: ethers.utils.parseEther('0.01') }
            );
            
            // Calculate total required ETH (initial liquidity + gas)
            const gasPrice = await this.provider.getGasPrice();
            const gasCost = estimatedGas.mul(gasPrice);
            const initialLiquidity = ethers.utils.parseEther('0.01');
            const totalRequired = initialLiquidity.add(gasCost);
            
            // Check escrow wallet balance
            const escrowBalance = await this.provider.getBalance(escrowAddress);
            
            // Fund escrow wallet if needed
            if (escrowBalance.lt(totalRequired)) {
                console.log(`⚠️ Escrow wallet needs funding. Balance: ${ethers.utils.formatEther(escrowBalance)}, Required: ${ethers.utils.formatEther(totalRequired)}`);
                await this.fundEscrowWallet(escrowAddress, totalRequired.sub(escrowBalance));
            }
            
            // Call create function on smart contract with escrow wallet
            console.log(`📝 Calling smart contract to create token from escrow wallet...`);
            const tx = await bondingCurveManager.create(
                name,
                symbol,
                { 
                    value: initialLiquidity,
                    gasLimit: estimatedGas.mul(110).div(100), // 10% buffer
                    gasPrice: gasPrice
                }
            );
            
            console.log(`⏳ Waiting for transaction confirmation...`);
            const receipt = await tx.wait();
            
            // Extract token address from events
            const tokenCreatedEvent = receipt.events?.find(
                event => event.event === 'TokenCreated'
            );
            
            if (!tokenCreatedEvent) {
                throw new Error('TokenCreated event not found');
            }
            
            const tokenAddress = tokenCreatedEvent.args.tokenAddress;
            const creatorAddress = tokenCreatedEvent.args.creator;
            
            console.log(`✅ Token minted! Address: ${tokenAddress}`);
            console.log(`👤 Creator (escrow wallet): ${creatorAddress}`);
            
            // Update token in database
            await Token.findByIdAndUpdate(tokenId, {
                address: tokenAddress.toLowerCase(),
                creator: creatorAddress.toLowerCase(),
                escrowWallet: escrowAddress.toLowerCase(),
                logo: ipfsImageUrl,
                status: 'MINTED',
                mintedAt: new Date(),
                mintTransactionHash: receipt.transactionHash
            });
            
            // Trigger comment on Twitter
            await this.triggerTwitterComment(tokenId, tokenAddress);
            
            return {
                success: true,
                tokenAddress,
                transactionHash: receipt.transactionHash,
                creatorAddress: creatorAddress
            };
            
        } catch (error) {
            console.error(`❌ Minting failed for token ${tokenId}:`, error.message);
            
            // Update status to FAILED
            await Token.findByIdAndUpdate(tokenId, {
                status: 'FAILED',
                processingError: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Trigger Twitter comment
    async triggerTwitterComment(tokenId, tokenAddress) {
        try {
            // Call internal API to comment on Twitter
            await axios.post(`http://localhost:${process.env.PORT || 5050}/api/comment-tweet`, {
                tokenId,
                tokenAddress
            });
        } catch (error) {
            console.error('Error triggering Twitter comment:', error.message);
        }
    }
}

module.exports = TokenMinterService; 