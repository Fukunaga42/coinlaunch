// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBondingCurveToken {
    // This interface represents the BondingCurveToken contract
    // Add specific token functions as needed
}

interface IBondingCurveManager {
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

    // Events
    event LiquidityAdded(
        address indexed token,
        uint256 ethAmount,
        uint256 tokenAmount
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

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

    // Struct for token information
    struct TokenInfo {
        IBondingCurveToken token;
        uint256 tokenbalance;
        uint256 ethBalance;
        bool isListed;
    }

    // State-changing functions
    // function addLP(address tokenAddress) external;
    
    function buy(address tokenAddress) external payable;
    
    function create(string memory name, string memory symbol) external payable;
    
    function renounceOwnership() external;
    
    function sell(address tokenAddress, uint256 tokenAmount) external;
    
    function setBancorFormula(address _bancorFormula) external;
    
    function setFeeRecipient(address payable _newRecipient) external;
    
    function setLpFeePercentage(uint256 _lpFeePercentage) external;
    
    function transferOwnership(address newOwner) external;

    // View functions
    function calculateCurvedBuyReturn(
        address tokenAddress,
        uint256 ethAmount
    ) external view returns (uint256);
    
    function calculateCurvedSellReturn(
        address tokenAddress,
        uint256 tokenAmount
    ) external view returns (uint256);
    
    function getCurrentTokenPrice(address tokenAddress) external view returns (uint256);
    
    function getMarketCap(address tokenAddress) external view returns (uint256);
    
    function getTokenEthBalance(address tokenAddress) external view returns (uint256);
    
    function owner() external view returns (address);
    
    function tokenList(uint256 index) external view returns (address);
    
    function tokens(address tokenAddress) external view returns (
        IBondingCurveToken token,
        uint256 tokenbalance,
        uint256 ethBalance,
        bool isListed
    );

    // Receive function
    receive() external payable;
}
