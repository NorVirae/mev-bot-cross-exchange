// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;
import "hardhat/console.sol";

// import libraries and interfaces
import "./libraries/SafeERC20.sol";
import "./libraries/SafeMath.sol";

import "./libraries/UniswapV2Library.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Router01.sol";
import "./interfaces/IUniswapV2Router02.sol";

contract UniswapCrossFlash {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    // factory and router  contract addresses
    address private constant UNISWAPV2_FACTORY =
        0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address private constant UNISWAPV2_ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    address private constant SUSHISWAPV2_FACTORY =
        0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac;
    address private constant SUSHISWAPV2_ROUTER =
        0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;

    // token contract addresses

    // address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    // address private constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    // address private constant LINK = 0x514910771AF9Ca656af840dff83E8264EcF986CA;

    // token addresses for polygon
    address private constant WETH = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
    address private constant USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
    address private constant LINK = 0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39;

    // set Deadline
    uint256 private deadline = block.timestamp + 20 minutes;
    uint256 private constant MAX_INT =
        115792089237316195423570985008687907853269984665640564039457584007913129639935;

    // Fund smart contract
    // function allows smart contract to be funded

    function fundFlashContract(
        address _owner,
        address _token,
        uint256 _amount
    ) public {
        IERC20(_token).transferFrom(_owner, address(this), _amount);
    }

    // get balance of token on contract
    function getFlashContractBalance(
        address _token
    ) public view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    // place trade function
    function placeTrade(
        address _fromToken,
        address _toToken,
        uint256 _amountIn,
        address factory,
        address router
    ) private returns (uint256) {
        // make sure pair exist so to not waste gas
        address pair = IUniswapV2Factory(factory).getPair(_fromToken, _toToken);
        require(pair != address(0), "There is no Liquidity");
        address[] memory path = new address[](2);
        path[0] = _fromToken;
        path[1] = _toToken;
        uint256 amountsOutMin = IUniswapV2Router01(router).getAmountsOut(
            _amountIn,
            path
        )[1];

        uint256 amountsReceived = IUniswapV2Router01(router)
            .swapExactTokensForTokens(
                _amountIn,
                amountsOutMin,
                path,
                address(this),
                deadline
            )[1];
        require(amountsReceived > 0, "Aborted Tx: Trade returned 0");
        return amountsReceived;
    }

    function checkSwapBuyLocation(
        uint256 _amountIn,
        address token1,
        address token2
    ) public view returns (string memory) {
        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        address[] memory path2 = new address[](2);
        path2[0] = token2;
        path2[1] = token1;

        string memory purchaseAt = "";
        uint256 firstExchangeTokenOut = IUniswapV2Router01(UNISWAPV2_ROUTER)
            .getAmountsOut(_amountIn, path)[1];
        console.log("AmountOut For firstExchange: %s", firstExchangeTokenOut);

        uint256 firstExchangeTokenOutSwapBack = IUniswapV2Router01(
            SUSHISWAPV2_ROUTER
        ).getAmountsOut(firstExchangeTokenOut, path2)[1];
        console.log(
            "AmountOut For firstExchangeSwapBack: %s",
            firstExchangeTokenOutSwapBack
        );

        uint256 secondExchangeTokenOut = IUniswapV2Router01(SUSHISWAPV2_ROUTER)
            .getAmountsOut(_amountIn, path)[1];
        console.log("AmountOut For SecondExchange: %s", secondExchangeTokenOut);

        uint256 secondExchangeTokenOutSwapBack = IUniswapV2Router01(
            UNISWAPV2_ROUTER
        ).getAmountsOut(secondExchangeTokenOut, path2)[1];
        console.log(
            "AmountOut For SecondExchangeSwapBack: %s",
            secondExchangeTokenOutSwapBack
        );

        if (firstExchangeTokenOut > secondExchangeTokenOut) {
            purchaseAt = "uniswap";
            console.log(
                "buy at uniswap and sell at sushiswap, uniswap has the lowest price for Dest token"
            );
        } else {
            purchaseAt = "sushiswap";
            console.log(
                "buy at sushiswap and sell at uniswap, sushiswap has the lowest price for Dest token"
            );
        }

        return purchaseAt;
    }

    // Get pair balance
    function getPairBalance()
        public
        view
        returns (uint256, uint256, uint256, uint256)
    {
        address pair = IUniswapV2Factory(UNISWAPV2_FACTORY).getPair(USDC, WETH);

        uint256 balance0 = IERC20(USDC).balanceOf(
            IUniswapV2Pair(pair).token0()
        );
        uint256 balance1 = IERC20(WETH).balanceOf(
            IUniswapV2Pair(pair).token1()
        );
        uint256 balance2 = IERC20(USDC).balanceOf(address(pair));
        uint256 balance3 = IERC20(USDC).balanceOf(address(this));
        // console.log("balance0: %s, balance1: %s, balance2: %s, balance3: %s", balance0, balance1, balance2, balance3);
        return (balance0, balance1, balance2, balance3);
    }

    // Check profitablity
    function checkProfitability(
        uint256 input,
        uint256 output
    ) public pure returns (bool) {
        bool isOutputBigger = output > input ? true : false;
        return isOutputBigger;
    }

    // get flashloan from contract
    function startLoan(address _tokenBorrow, uint256 _amount) external {
        IERC20(WETH).safeApprove(address(UNISWAPV2_ROUTER), MAX_INT);
        IERC20(USDC).safeApprove(address(UNISWAPV2_ROUTER), MAX_INT);
        IERC20(LINK).safeApprove(address(UNISWAPV2_ROUTER), MAX_INT);

        IERC20(WETH).safeApprove(address(SUSHISWAPV2_ROUTER), MAX_INT);
        IERC20(USDC).safeApprove(address(SUSHISWAPV2_ROUTER), MAX_INT);
        IERC20(LINK).safeApprove(address(SUSHISWAPV2_ROUTER), MAX_INT);
        // get the factory pair address for combined
        address pair = IUniswapV2Factory(UNISWAPV2_FACTORY).getPair(
            _tokenBorrow,
            WETH
        );

        require(pair != address(0), "pool doesn't exist");

        // get pair
        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();

        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair)
            .getReserves();
        uint256 amountOut0 = _tokenBorrow == token0 ? _amount : 0;
        uint256 amountOut1 = _tokenBorrow == token1 ? _amount : 0;

        // encode data
        bytes memory data = abi.encode(_tokenBorrow, _amount, msg.sender);

        console.log(
            "SWAP AMOUNTS: amountOut0: %s amountOut1: %s, balance: %s",
            amountOut0,
            amountOut1,
            IERC20(_tokenBorrow).balanceOf(address(this))
        );
        // call swap
        IUniswapV2Pair(pair).swap(amountOut0, amountOut1, address(this), data);
    }

    function uniswapV2Call(
        address _sender,
        uint256 _amount0,
        uint256 _amount1,
        bytes calldata _data
    ) external {
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();

        address pair = IUniswapV2Factory(UNISWAPV2_FACTORY).getPair(
            token0,
            token1
        );
        require(pair == msg.sender, "pool does not exist");
        require(
            _sender == address(this),
            "Swap call was not called by this contract"
        );

        // decode data
        (address _tokenBorrow, uint256 _amount, address myAddress) = abi.decode(
            _data,
            (address, uint256, address)
        );
        // calculate amount to repay
        uint256 fee = ((_amount * 3) / 997) + 1;
        uint256 amountToRepay = _amount.add(fee);

        // Perform arbitrage
        // get Trade amount
        uint256 tradeAmount = _amount0 > 0 ? _amount0 : _amount1;
        // placeTrade
        uint256 trade1AcquiredCoin = placeTrade(
            USDC,
            LINK,
            tradeAmount,
            UNISWAPV2_FACTORY,
            UNISWAPV2_ROUTER
        );
        uint256 trade2AcquiredCoin = placeTrade(
            LINK,
            USDC,
            trade1AcquiredCoin,
            SUSHISWAPV2_FACTORY,
            SUSHISWAPV2_ROUTER
        );

        address pairGuy = IUniswapV2Factory(UNISWAPV2_FACTORY).getPair(
            USDC,
            LINK
        );

        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pairGuy)
            .getReserves();
        console.log("Reserve 1: %s", reserve0);
        console.log("Reserve 2: %s", reserve1);

        // check trade profitablity
        bool isOutputBigger = checkProfitability(
            amountToRepay,
            trade2AcquiredCoin
        );
        require(isOutputBigger, "Trade not profitable");

        // if (isOutputBigger) {
        //     IERC20 otherToken = IERC20(WETH);
        //     otherToken.transfer(myAddress, trade2AcquiredCoin - amountToRepay);
        // }
        console.log(
            "SOL: check amount %s, balance: %s",
            amountToRepay,
            IERC20(_tokenBorrow).balanceOf(address(this))
        );

        // Pay back loan
        IERC20(_tokenBorrow).safeTransfer(pair, amountToRepay);
    }
}
