// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Uniswap V4 Core Imports
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

// Uniswap V4 Periphery Imports
import {IPositionManager} from "v4-periphery/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/libraries/Actions.sol";


interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

contract PumpToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public factory;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor(string memory _name, string memory _symbol, address _creator) {
        name = _name;
        symbol = _symbol;
        factory = msg.sender;
        _mint(_creator, 1 ether);
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function mintFromFactory(address to, uint256 amount) external onlyFactory {
        _mint(to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(
            allowance[from][msg.sender] >= amount,
            "Insufficient allowance"
        );
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract BondingCurveManager is Ownable, ReentrancyGuard, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // Custom Errors
    error FailedToSendEth();
    error InsufficientPoolbalance();
    error InvalidLpFeePercentage();
    error InvalidRecipient();
    error MaxPoolBalanceReached();
    error PairCreationFailed();
    error TokenAlreadyListed();
    error TokenDoesNotExist();
    error TokenTransferFailed();
    error ZeroEthSent();
    error ZeroTokenAmount();
    error Unauthorized();

    struct TokenInfo {
        address creator;
        address tokenAddress;
        uint256 vReserveEth;
        uint256 vReserveToken;
        uint256 rReserveEth;
        int256 rReserveToken;
        bool liquidityMigrated;
    }

    struct MigrationData {
        address tokenAddress;
        uint256 ethAmount;
        uint256 tokenAmount;
    }

    mapping(address => TokenInfo) public tokenInfos;

    // Uniswap V4 Contracts
    IPoolManager public poolManager;
    IPositionManager public positionManager;
    address public WETH;

    // Uniswap V4 Configuration
    uint24 public constant UNISWAP_FEE_TIER = 10000; // 1% fee
    int24 public constant TICK_SPACING = 200; // Appropriate for 1% fee tier
    address public constant HOOK_ADDRESS = address(0); // Placeholder for future hooks

    uint256 public V_ETH_RESERVE;
    uint256 public V_TOKEN_RESERVE;
    uint256 public R_TOKEN_RESERVE;
    uint256 public TRADE_FEE_BPS;
    uint256 public BPS_DENOMINATOR;
    uint256 public GRADUATION_THRESHOLD;
    uint256 public totalFee;

    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol
    );
    event TokensBought(
        address indexed token,
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount
    );
    event TokensSold(
        address indexed token,
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount
    );
    event LiquidityAdded(
        address indexed token,
        uint256 ethAmount,
        uint256 tokenAmount
    );
    event LiquiditySwapped(
        address indexed token,
        uint256 tokenAmount,
        uint256 ethAmount
    );
    event ClaimedFee(uint256 amount);

    constructor(
        address _poolManager,
        address _positionManager,
        address _weth
    ) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        WETH = _weth;

        V_ETH_RESERVE = 15 ether / 1000;
        V_TOKEN_RESERVE = 1073000000 ether;
        R_TOKEN_RESERVE = 793100000 ether;
        TRADE_FEE_BPS = 100; // 1% fee in basis points
        BPS_DENOMINATOR = 10000;
        GRADUATION_THRESHOLD = 0.5 ether; // ETH threshold for graduation
    }

    // IUnlockCallback implementation
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        // Ensure only the PoolManager can call this
        if (msg.sender != address(poolManager)) revert Unauthorized();
        
        // Decode the migration data
        MigrationData memory migrationData = abi.decode(data, (MigrationData));
        
        // Execute the migration logic
        _executeMigration(migrationData);
        
        return "";
    }

    function create(
        string memory _name,
        string memory _symbol
    ) external payable {
        PumpToken token = new PumpToken(_name, _symbol, msg.sender);
        TokenInfo storage info = tokenInfos[address(token)];
        info.creator = msg.sender;
        info.tokenAddress = address(token);
        info.rReserveEth = 0;
        info.rReserveToken = int256(R_TOKEN_RESERVE);
        info.vReserveEth = V_ETH_RESERVE;
        info.vReserveToken = V_TOKEN_RESERVE;

        if (msg.value > 0) {
            uint256 fee = (msg.value * TRADE_FEE_BPS) / BPS_DENOMINATOR;
            uint256 netEthIn = msg.value - fee;
            (
                uint256 newReserveEth,
                uint256 newReserveToken
            ) = _calculateReserveAfterBuy(
                    V_ETH_RESERVE,
                    V_TOKEN_RESERVE,
                    netEthIn
                );
            uint256 tokensOut = info.vReserveToken - newReserveToken;
            info.vReserveEth = newReserveEth;
            info.vReserveToken = newReserveToken;
            info.rReserveEth = netEthIn;
            info.rReserveToken -= int256(tokensOut);

            token.mintFromFactory(msg.sender, tokensOut);
            emit TokensBought(address(token), msg.sender, msg.value, tokensOut);
            totalFee += fee;

            // Check for graduation after initial buy
            if (
                info.rReserveEth >= GRADUATION_THRESHOLD &&
                !info.liquidityMigrated
            ) {
                _migrateToUniswapV4(address(token));
            }
        }
        info.liquidityMigrated = false;

        // Add token to the list
        tokenListArray.push(address(token));

        emit TokenCreated(address(token), msg.sender, _name, _symbol);
    }

    function _calculateReserveAfterBuy(
        uint256 reserveEth,
        uint256 reserveToken,
        uint256 ethIn
    ) internal pure returns (uint256, uint256) {
        uint256 newReserveEth = ethIn + reserveEth;
        uint256 newReserveToken = (reserveEth * reserveToken) / newReserveEth;
        return (newReserveEth, newReserveToken);
    }

    function buy(address _token) external payable nonReentrant {
        TokenInfo storage info = tokenInfos[_token];
        require(info.tokenAddress != address(0), "Invalid token");
        require(msg.value > 0, "Amount must be greater than 0");
        require(!info.liquidityMigrated, "Trading moved to Uniswap");

        uint256 fee = (msg.value * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netEthIn = msg.value - fee;

        (
            uint256 newReserveEth,
            uint256 newReserveToken
        ) = _calculateReserveAfterBuy(
                info.vReserveEth,
                info.vReserveToken,
                netEthIn
            );

        uint256 tokensOut = info.vReserveToken - newReserveToken;
        require(tokensOut > 0, "No tokens to mint");

        // Update reserves
        info.vReserveEth = newReserveEth;
        info.vReserveToken = newReserveToken;
        info.rReserveEth += netEthIn;
        info.rReserveToken -= int256(tokensOut);

        // Mint tokens to buyer
        PumpToken(info.tokenAddress).mintFromFactory(msg.sender, tokensOut);

        // Add fee to total
        totalFee += fee;

        emit TokensBought(_token, msg.sender, msg.value, tokensOut);

        // Check for automatic graduation after buy
        if (
            info.rReserveEth >= GRADUATION_THRESHOLD && !info.liquidityMigrated
        ) {
            _migrateToUniswapV4(_token);
        }
    }

    function sell(address _token, uint256 tokenAmount) external nonReentrant {
        TokenInfo storage info = tokenInfos[_token];
        require(info.tokenAddress != address(0), "Invalid token");
        require(tokenAmount > 0, "Amount must be greater than 0");
        require(!info.liquidityMigrated, "Trading moved to Uniswap");

        uint256 newReserveToken = info.vReserveToken + tokenAmount;
        uint256 newReserveEth = (info.vReserveEth * info.vReserveToken) /
            newReserveToken;

        uint256 grossEthOut = info.vReserveEth - newReserveEth;
        uint256 fee = (grossEthOut * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netEthOut = grossEthOut - fee;

        require(
            grossEthOut > 0 && grossEthOut <= info.rReserveEth,
            "Insufficient ETH in contract"
        );

        bool success = IERC20(_token).transferFrom(
            msg.sender,
            address(this),
            tokenAmount
        );
        require(success, "Transfer failed");

        info.vReserveEth = newReserveEth;
        info.vReserveToken = newReserveToken;
        info.rReserveEth -= grossEthOut;
        info.rReserveToken += int256(tokenAmount);

        payable(msg.sender).transfer(netEthOut);
        totalFee += fee;

        emit TokensSold(_token, msg.sender, tokenAmount, netEthOut);
    }

    // Internal function to migrate liquidity to Uniswap V4
    function _migrateToUniswapV4(address tokenAddress) internal {
        TokenInfo storage info = tokenInfos[tokenAddress];

        // Mark as migrated first to prevent reentrancy
        info.liquidityMigrated = true;

        // Calculate tokens to add to liquidity (remaining tokens from bonding curve)
        uint256 tokensForLP = info.rReserveToken >= 0
            ? uint256(info.rReserveToken)
            : 0;
        uint256 ethForLP = info.rReserveEth;

        // Mint remaining tokens to this contract for liquidity
        if (tokensForLP > 0) {
            PumpToken(tokenAddress).mintFromFactory(address(this), tokensForLP);
        }

        if (ethForLP > 0 && tokensForLP > 0) {
            // Wrap ETH to WETH for V4 compatibility
            IWETH(WETH).deposit{value: ethForLP}();

            // Prepare migration data
            MigrationData memory migrationData = MigrationData({
                tokenAddress: tokenAddress,
                ethAmount: ethForLP,
                tokenAmount: tokensForLP
            });

            // Use unlock pattern to execute migration
            poolManager.unlock(abi.encode(migrationData));

            emit LiquidityAdded(tokenAddress, ethForLP, tokensForLP);
        } else {
            // Even if no liquidity to add, emit event for graduation
            emit LiquidityAdded(tokenAddress, ethForLP, tokensForLP);
        }
    }

    function _executeMigration(MigrationData memory data) internal {
        // Create pool key
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH (native currency)
            currency1: Currency.wrap(data.tokenAddress),
            fee: UNISWAP_FEE_TIER,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK_ADDRESS) // No hooks for now
        });

        // Ensure proper currency ordering (currency0 < currency1)
        if (uint160(address(0)) > uint160(data.tokenAddress)) {
            (key.currency0, key.currency1) = (key.currency1, key.currency0);
        }

        // Try to initialize the pool (will revert if already initialized)
        try poolManager.initialize(key, TickMath.getSqrtPriceAtTick(0)) {
            // Pool was successfully initialized
        } catch {
            // Pool already exists, continue
        }

        // Prepare full-range position
        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);

        // Approve tokens for position manager
        IERC20(WETH).approve(address(positionManager), data.ethAmount);
        IERC20(data.tokenAddress).approve(address(positionManager), data.tokenAmount);

        // Define actions for minting position
        bytes memory actions = abi.encodePacked(
            Actions.MINT_POSITION,
            Actions.SETTLE_PAIR
        );

        // Prepare parameters
        bytes[] memory params = new bytes[](2);
        
        // Parameters for MINT_POSITION
        params[0] = abi.encode(
            key,                    // PoolKey
            tickLower,              // Lower tick
            tickUpper,              // Upper tick
            uint256(1000000),       // Liquidity amount (will be calculated)
            data.ethAmount,         // Max amount0
            data.tokenAmount,       // Max amount1
            address(0),             // Burn the position NFT
            ""                      // No hook data
        );

        // Parameters for SETTLE_PAIR
        params[1] = abi.encode(
            key.currency0,          // Currency0
            key.currency1           // Currency1
        );

        // Execute the position creation
        positionManager.modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 300   // 5 minute deadline
        );
    }

    function updateFeeRate(uint256 value) external onlyOwner {
        TRADE_FEE_BPS = value;
    }

    function updateGraduationThreshold(uint256 value) external onlyOwner {
        GRADUATION_THRESHOLD = value;
    }

    function claimFee(address to) external onlyOwner {
        uint256 feeAmount = totalFee;
        totalFee = 0;
        payable(to).transfer(feeAmount);
        emit ClaimedFee(feeAmount);
    }

    // View functions required by the interface
    function calculateCurvedBuyReturn(
        address tokenAddress,
        uint256 ethAmount
    ) external view returns (uint256) {
        TokenInfo storage info = tokenInfos[tokenAddress];
        require(info.tokenAddress != address(0), "Invalid token");

        uint256 fee = (ethAmount * TRADE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netEthIn = ethAmount - fee;

        uint256 newReserveToken = _calculateReserveAfterBuyView(
            info.vReserveEth,
            info.vReserveToken,
            netEthIn
        );

        return info.vReserveToken - newReserveToken;
    }

    function calculateCurvedSellReturn(
        address tokenAddress,
        uint256 tokenAmount
    ) external view returns (uint256) {
        TokenInfo storage info = tokenInfos[tokenAddress];
        require(info.tokenAddress != address(0), "Invalid token");

        uint256 newReserveToken = info.vReserveToken + tokenAmount;
        uint256 newReserveEth = (info.vReserveEth * info.vReserveToken) /
            newReserveToken;

        uint256 grossEthOut = info.vReserveEth - newReserveEth;
        uint256 fee = (grossEthOut * TRADE_FEE_BPS) / BPS_DENOMINATOR;

        return grossEthOut - fee;
    }

    function getCurrentTokenPrice(
        address tokenAddress
    ) external view returns (uint256) {
        TokenInfo storage info = tokenInfos[tokenAddress];
        require(info.tokenAddress != address(0), "Invalid token");

        // Price = ETH reserve / Token reserve (in wei)
        if (info.vReserveToken == 0) return 0;
        return (info.vReserveEth * 1e18) / info.vReserveToken;
    }

    function getMarketCap(
        address tokenAddress
    ) external view returns (uint256) {
        TokenInfo storage info = tokenInfos[tokenAddress];
        require(info.tokenAddress != address(0), "Invalid token");

        uint256 totalSupply = PumpToken(tokenAddress).totalSupply();
        uint256 price = this.getCurrentTokenPrice(tokenAddress);

        return (totalSupply * price) / 1e18;
    }

    function getTokenEthBalance(
        address tokenAddress
    ) external view returns (uint256) {
        TokenInfo storage info = tokenInfos[tokenAddress];
        require(info.tokenAddress != address(0), "Invalid token");

        return info.rReserveEth;
    }

    function setLpFeePercentage(uint256 _lpFeePercentage) external onlyOwner {
        TRADE_FEE_BPS = _lpFeePercentage;
    }

    // Token list functionality
    address[] public tokenListArray;

    function tokenList(uint256 index) external view returns (address) {
        require(index < tokenListArray.length, "Index out of bounds");
        return tokenListArray[index];
    }

    // Interface-compatible tokens function
    function tokens(
        address tokenAddress
    )
        external
        view
        returns (
            address token,
            uint256 tokenbalance,
            uint256 ethBalance,
            bool isListed
        )
    {
        TokenInfo storage info = tokenInfos[tokenAddress];
        return (
            info.tokenAddress,
            info.rReserveToken >= 0 ? uint256(info.rReserveToken) : 0,
            info.rReserveEth,
            info.tokenAddress != address(0)
        );
    }

    // Helper function for view calculations
    function _calculateReserveAfterBuyView(
        uint256 reserveEth,
        uint256 reserveToken,
        uint256 ethIn
    ) internal pure returns (uint256) {
        uint256 newReserveEth = ethIn + reserveEth;
        uint256 newReserveToken = (reserveEth * reserveToken) / newReserveEth;
        return newReserveToken;
    }

    receive() external payable {}
}
