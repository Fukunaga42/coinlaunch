// MINIMAL MAPPING FOR TESTING - Full mapping backed up in mapping.ts.backup

import { BigInt, BigDecimal, Bytes, Address } from "@graphprotocol/graph-ts"
import {
  TokenCreated,
  TokensBought,
  TokensSold,
  LiquidityAdded
} from "../generated/BondingCurveManager/BondingCurveManager"
import {
  Token,
  Transaction,
  TokenPriceMinute
} from "../generated/schema"

// Constants
const ZERO_BD = BigDecimal.fromString("0")
const ONE_BD = BigDecimal.fromString("1")
const SECONDS_PER_MINUTE = BigInt.fromI32(60)

// Helper function to convert BigInt to BigDecimal with 18 decimals
function toDecimal(value: BigInt): BigDecimal {
  return value.toBigDecimal().div(BigDecimal.fromString("1000000000000000000"))
}

// Helper function to calculate token price in wei (wei per token)
function calculateTokenPriceInWei(ethAmountWei: BigInt, tokenAmountWei: BigInt): BigInt {
  if (tokenAmountWei.equals(BigInt.fromI32(0))) {
    return BigInt.fromI32(0)
  }
  // Calculate: (ethAmount * 1e18) / tokenAmount to get wei per token
  let ethAmountScaled = ethAmountWei.times(BigInt.fromString("1000000000000000000"))
  return ethAmountScaled.div(tokenAmountWei)
}

// Helper function to round timestamp down to nearest minute
function getMinuteTimestamp(timestamp: BigInt): BigInt {
  return timestamp.minus(timestamp.mod(SECONDS_PER_MINUTE))
}

// Helper function to create or update TokenPriceMinute entity
function updateTokenPriceMinute(
  tokenAddress: Address,
  timestamp: BigInt,
  price: BigInt,
  volume: BigDecimal,
  transactionCount: BigInt
): void {
  let minuteTimestamp = getMinuteTimestamp(timestamp)
  let id = tokenAddress.toHexString() + "-" + minuteTimestamp.toString()
  let idBytes = Bytes.fromUTF8(id)
  
  let priceMinute = TokenPriceMinute.load(idBytes)
  
  if (priceMinute == null) {
    // Create new minute entity
    priceMinute = new TokenPriceMinute(idBytes)
    priceMinute.token = tokenAddress
    priceMinute.timestamp = minuteTimestamp
    priceMinute.minute = minuteTimestamp
    priceMinute.tokenPrice = price
    priceMinute.priceOpen = price
    priceMinute.priceClose = price
    priceMinute.priceHigh = price
    priceMinute.priceLow = price
    priceMinute.volume = volume
    priceMinute.transactions = transactionCount
  } else {
    // Update existing minute entity
    priceMinute.priceClose = price
    priceMinute.tokenPrice = price // Latest price
    
    // Update high/low
    if (price.gt(priceMinute.priceHigh)) {
      priceMinute.priceHigh = price
    }
    if (price.lt(priceMinute.priceLow)) {
      priceMinute.priceLow = price
    }
    
    // Add to volume and transaction count
    priceMinute.volume = priceMinute.volume.plus(volume)
    priceMinute.transactions = priceMinute.transactions.plus(transactionCount)
  }
  
  priceMinute.save()
}

export function handleTokenCreated(event: TokenCreated): void {
  let tokenAddress = event.params.tokenAddress
  let creator = event.params.creator
  let name = event.params.name
  let symbol = event.params.symbol
  
  // Create token entity - MINIMAL VERSION
  let token = new Token(tokenAddress)
  token.address = tokenAddress
  token.creator = creator
  token.name = name
  token.symbol = symbol
  token.createdAt = event.block.timestamp
  token.createdAtBlock = event.block.number
  token.createdTxHash = event.transaction.hash
  
  // Initialize basic metrics
  token.totalVolume = ZERO_BD
  token.totalSupply = BigDecimal.fromString("1") // Initial supply of 1 token to creator
  token.isGraduated = false
  
  token.save()
  
  // Create transaction record - MINIMAL VERSION
  let transactionId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transaction = new Transaction(transactionId)
  transaction.hash = event.transaction.hash
  transaction.type = "CREATE"
  transaction.token = tokenAddress
  transaction.user = creator
  transaction.ethAmount = ZERO_BD
  transaction.tokenAmount = BigDecimal.fromString("1")
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.save()
}

export function handleTokensBought(event: TokensBought): void {
  let tokenAddress = event.params.token
  let buyer = event.params.buyer
  let ethAmount = toDecimal(event.params.ethAmount)
  let tokenAmount = toDecimal(event.params.tokenAmount)
  
  // Load token - MINIMAL VERSION
  let token = Token.load(tokenAddress)
  if (token == null) {
    return // Token should exist
  }
  
  // Update basic token metrics
  token.totalVolume = token.totalVolume.plus(ethAmount)
  token.totalSupply = token.totalSupply.plus(tokenAmount)
  token.save()
  
  // Calculate and track price per minute in wei
  let priceInWei = calculateTokenPriceInWei(event.params.ethAmount, event.params.tokenAmount)
  updateTokenPriceMinute(
    tokenAddress,
    event.block.timestamp,
    priceInWei,
    ethAmount,
    BigInt.fromI32(1)
  )
  
  // Create transaction record - MINIMAL VERSION
  let transactionId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transaction = new Transaction(transactionId)
  transaction.hash = event.transaction.hash
  transaction.type = "BUY"
  transaction.token = tokenAddress
  transaction.user = buyer
  transaction.ethAmount = ethAmount
  transaction.tokenAmount = tokenAmount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.save()
}

export function handleTokensSold(event: TokensSold): void {
  let tokenAddress = event.params.token
  let seller = event.params.seller
  let tokenAmount = toDecimal(event.params.tokenAmount)
  let ethAmount = toDecimal(event.params.ethAmount)
  
  // Load token - MINIMAL VERSION
  let token = Token.load(tokenAddress)
  if (token == null) {
    return // Token should exist
  }
  
  // Update basic token metrics
  token.totalVolume = token.totalVolume.plus(ethAmount)
  token.totalSupply = token.totalSupply.minus(tokenAmount)
  token.save()
  
  // Calculate and track price per minute in wei
  let priceInWei = calculateTokenPriceInWei(event.params.ethAmount, event.params.tokenAmount)
  updateTokenPriceMinute(
    tokenAddress,
    event.block.timestamp,
    priceInWei,
    ethAmount,
    BigInt.fromI32(1)
  )
  
  // Create transaction record - MINIMAL VERSION
  let transactionId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transaction = new Transaction(transactionId)
  transaction.hash = event.transaction.hash
  transaction.type = "SELL"
  transaction.token = tokenAddress
  transaction.user = seller
  transaction.ethAmount = ethAmount
  transaction.tokenAmount = tokenAmount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.save()
}

export function handleLiquidityAdded(event: LiquidityAdded): void {
  let tokenAddress = event.params.token
  let ethAmount = toDecimal(event.params.ethAmount)
  let tokenAmount = toDecimal(event.params.tokenAmount)
  
  // Load token - MINIMAL VERSION
  let token = Token.load(tokenAddress)
  if (token == null) {
    return // Token should exist
  }
  
  // Mark token as graduated
  token.isGraduated = true
  token.save()
  
  // Create transaction record - MINIMAL VERSION
  let transactionId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transaction = new Transaction(transactionId)
  transaction.hash = event.transaction.hash
  transaction.type = "GRADUATE"
  transaction.token = tokenAddress
  transaction.user = Address.fromString("0x0000000000000000000000000000000000000000") // System transaction
  transaction.ethAmount = ethAmount
  transaction.tokenAmount = tokenAmount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.save()
}

// COMMENTED OUT FOR MINIMAL TESTING - UNCOMMENT LATER
//
// All the complex helper functions and logic from the original mapping.ts.backup:
// - getOrCreateUser()
// - getOrCreatePlatformStats()
// - calculateGraduationProgress()
// - calculateEthToGraduation()
// - updateDailyStats()
// - updateHourlyStats()
// - Complex holder tracking
// - Platform statistics
// - Price calculations
// - Market cap calculations
// - Graduation progress tracking
// - All the advanced metrics and relationships
//
// These can be gradually added back once basic indexing is working
