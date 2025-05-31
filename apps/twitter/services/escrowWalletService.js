const { ethers } = require('ethers');
const Token = require('../models/Token');
const EscrowWallet = require('../models/EscrowWallet');

class EscrowWalletService {
    constructor() {
        if (!process.env.ETH_RPC_URL) {
            console.warn('⚠️ ETH_RPC_URL not set - escrow service will not work');
            this.isConfigured = false;
            return;
        }
        
        this.provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
        this.bondingCurveManagerAddress = process.env.BONDING_CURVE_MANAGER_ADDRESS;
        this.bondingCurveManagerABI = require('../abi/BondingCurveManager.json');
        this.isConfigured = true;
    }

    // Generate or get escrow wallet for a Twitter user
    async getOrCreateEscrowWallet(twitterUsername) {
        try {
            // Check if user already has an escrow wallet in the EscrowWallet collection
            const existingWallet = await EscrowWallet.findOne({ 
                twitterUsername: twitterUsername
            });

            if (existingWallet) {
                console.log(`✅ Found existing escrow wallet for @${twitterUsername}`);
                return existingWallet.address;
            }

            // Generate new escrow wallet
            const wallet = ethers.Wallet.createRandom();
            const escrowAddress = wallet.address;
            const privateKey = wallet.privateKey;
            
            // Encrypt and save the wallet
            const encryptedPrivateKey = EscrowWallet.encryptPrivateKey(privateKey);
            
            const newEscrowWallet = new EscrowWallet({
                twitterUsername: twitterUsername,
                address: escrowAddress,
                encryptedPrivateKey: encryptedPrivateKey
            });
            
            await newEscrowWallet.save();
            console.log(`🔐 Generated and saved new escrow wallet for @${twitterUsername}: ${escrowAddress}`);
            
            // Update all tokens for this user with the escrow wallet
            await Token.updateMany(
                { twitterUsername: twitterUsername },
                { $set: { escrowWallet: escrowAddress } }
            );

            return escrowAddress;
        } catch (error) {
            console.error('Error creating escrow wallet:', error);
            throw error;
        }
    }

    // Get escrow wallet instance with private key
    async getEscrowWalletInstance(twitterUsername) {
        try {
            const escrowWalletDoc = await EscrowWallet.findOne({ 
                twitterUsername: twitterUsername 
            });
            
            if (!escrowWalletDoc) {
                throw new Error(`No escrow wallet found for @${twitterUsername}`);
            }
            
            // Decrypt the private key
            const privateKey = EscrowWallet.decryptPrivateKey(escrowWalletDoc.encryptedPrivateKey);
            
            // Create wallet instance
            const wallet = new ethers.Wallet(privateKey, this.provider);
            
            // Update last used timestamp
            await EscrowWallet.updateOne(
                { _id: escrowWalletDoc._id },
                { $set: { lastUsedAt: new Date() } }
            );
            
            return wallet;
        } catch (error) {
            console.error('Error getting escrow wallet instance:', error);
            throw error;
        }
    }

    // Get claimable fees for a Twitter user
    async getClaimableFees(twitterUsername) {
        try {
            const escrowWallet = await this.getOrCreateEscrowWallet(twitterUsername);
            
            // Get all tokens created by this user
            const userTokens = await Token.find({
                twitterUsername: twitterUsername,
                status: 'COMMENTED',
                address: { $exists: true, $ne: null }
            });

            let totalClaimable = ethers.BigNumber.from(0);
            const tokenDetails = [];

            // For each token, check claimable fees
            for (const token of userTokens) {
                try {
                    const contract = new ethers.Contract(
                        this.bondingCurveManagerAddress,
                        this.bondingCurveManagerABI,
                        this.provider
                    );

                    // Get token info from contract
                    const tokenInfo = await contract.tokenInfos(token.address);
                    const creatorAddress = tokenInfo.creator;
                    
                    // Check if creator matches escrow wallet (fees should be accumulated here)
                    if (creatorAddress.toLowerCase() === escrowWallet.toLowerCase()) {
                        // Get ETH balance that can be claimed
                        const balance = await this.provider.getBalance(escrowWallet);
                        totalClaimable = totalClaimable.add(balance);
                        
                        tokenDetails.push({
                            tokenAddress: token.address,
                            tokenName: token.name,
                            tokenSymbol: token.symbol,
                            claimableAmount: balance.toString()
                        });
                    }
                } catch (error) {
                    console.error(`Error checking fees for token ${token.address}:`, error);
                }
            }

            return {
                escrowWallet: escrowWallet,
                totalClaimable: totalClaimable.toString(),
                totalClaimableETH: ethers.utils.formatEther(totalClaimable),
                tokens: tokenDetails
            };
        } catch (error) {
            console.error('Error getting claimable fees:', error);
            throw error;
        }
    }

    // Claim fees (transfer from escrow to user wallet)
    async claimFees(twitterUsername, destinationAddress) {
        try {
            if (!ethers.utils.isAddress(destinationAddress)) {
                throw new Error('Invalid destination address');
            }

            const claimableInfo = await this.getClaimableFees(twitterUsername);
            
            if (claimableInfo.totalClaimable === '0') {
                throw new Error('No fees to claim');
            }

            // Get the escrow wallet instance with private key
            const escrowWallet = await this.getEscrowWalletInstance(twitterUsername);
            
            console.log(`📤 Claiming ${claimableInfo.totalClaimableETH} ETH to ${destinationAddress}`);
            console.log(`📍 From escrow wallet: ${escrowWallet.address}`);

            // Calculate gas fees to leave some ETH for gas
            const gasPrice = await this.provider.getGasPrice();
            const gasLimit = 21000; // Standard ETH transfer
            const gasCost = gasPrice.mul(gasLimit);
            
            // Calculate amount to send (total minus gas)
            const totalBalance = ethers.BigNumber.from(claimableInfo.totalClaimable);
            const amountToSend = totalBalance.sub(gasCost);
            
            if (amountToSend.lte(0)) {
                throw new Error('Insufficient balance to cover gas fees');
            }
            
            // Send transaction
            const tx = await escrowWallet.sendTransaction({
                to: destinationAddress,
                value: amountToSend,
                gasLimit: gasLimit,
                gasPrice: gasPrice
            });
            
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed: ${receipt.transactionHash}`);
            
            // Update total fees collected
            await EscrowWallet.updateOne(
                { twitterUsername: twitterUsername },
                { 
                    $inc: { 
                        totalFeesCollected: ethers.utils.formatEther(amountToSend) 
                    } 
                }
            );

            return {
                success: true,
                transactionHash: receipt.transactionHash,
                amountClaimed: ethers.utils.formatEther(amountToSend),
                destinationAddress: destinationAddress
            };
        } catch (error) {
            console.error('Error claiming fees:', error);
            throw error;
        }
    }

    // Verify Twitter account ownership
    async verifyTwitterOwnership(userId, twitterUsername) {
        // TODO: This method will be implemented by the Privy team
        // For now, return false to prevent unauthorized access
        console.log(`🔍 Twitter ownership verification pending implementation for @${twitterUsername}`);
        return false;
    }
}

module.exports = EscrowWalletService; 