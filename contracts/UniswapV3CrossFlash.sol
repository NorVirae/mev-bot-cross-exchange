// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;
pragma abicoder v2;

import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";

import "@uniswap/v3-periphery/contracts/base/PeripheryPayments.sol";
import "@uniswap/v3-periphery/contracts/base/PeripheryImmutableState.sol";
import "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import "@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "hardhat/console.sol";
import "./interfaces/IUniswapV2Router01.sol";
import "./interfaces/IUniswapV2Factory.sol";

/// @title Flash contract implementation
/// @notice An example contract using the Uniswap V3 flash function
contract UniswapV3CrossFlash is
    IUniswapV3FlashCallback,
    PeripheryImmutableState,
    PeripheryPayments
{
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;

    ISwapRouter public immutable swapRouter;
    address public immutable sushiSwapRouter;
    address public sushiFactory = 0xc35DADB65012eC5796536bD9864eD8773aBc74C4;
    uint256 constant MAX_INT =
        115792089237316195423570985008687907853269984665640564039457584007913129639935;

    constructor(
        address _swapRouter,
        address _factory,
        address _WETH9,
        address _sushiSwapRouterAddress
    ) PeripheryImmutableState(_factory, _WETH9) {
        swapRouter = ISwapRouter(_swapRouter);
        sushiSwapRouter = _sushiSwapRouterAddress;
    }

    /// @param fee0 The fee from calling flash for token0
    /// @param fee1 The fee from calling flash for token1
    /// @param data The data needed in the callback passed as FlashCallbackData from `initFlash`
    /// @notice implements the callback called from flash
    /// @dev fails if the flash is not profitable, meaning the amountOut from the flash is less than the amount borrowed
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external override {
        FlashCallbackData memory decoded = abi.decode(
            data,
            (FlashCallbackData)
        );
        CallbackValidation.verifyCallback(factory, decoded.poolKey);

        uint256 borrowedAmount = decoded.amount0 > 0
            ? decoded.amount0
            : decoded.amount1;

        address tokenBorrow = decoded.amount0 > 0
            ? decoded.poolKey.token0
            : decoded.poolKey.token1;

        uint256 fee = decoded.amount0 > 0 ? fee0 : fee1;

        TransferHelper.safeApprove(
            tokenBorrow,
            address(swapRouter),
            borrowedAmount
        );
        TransferHelper.safeApprove(
            tokenBorrow,
            address(sushiFactory),
            MAX_INT
        );
        TransferHelper.safeApprove(
            decoded.arbToken2,
            address(sushiFactory),
            MAX_INT
        );

        // profitable check
        // exactInputSingle will fail if this amount not met
        // uint256 amount1Min = LowGasSafeMath.add(decoded.amount1, fee1);
        // uint256 amount0Min = LowGasSafeMath.add(decoded.amount0, fee0);
        console.log(
            "Account Balance: Arbtoken0 %s, arbToken1: %s",
            IERC20(address(tokenBorrow)).balanceOf(address(this)),
            IERC20(address(decoded.arbToken2)).balanceOf(address(this))
        );

        require(
            decoded.arbToken1 == tokenBorrow,
            "arbToken1 should be the token borrowed"
        );
        console.log("borrow Amount 1 :%s", borrowedAmount);
        // Perform arbitrage
        uint256 trade1Amount = placeTradeUniswap(
            decoded.arbToken1,
            decoded.arbToken2,
            borrowedAmount
        );

        console.log("trade Amount 1 :%s", trade1Amount);
        uint256 trade2Amount = placeTradeSushi(
            decoded.arbToken2,
            decoded.arbToken1,
            trade1Amount
        );

        // end up with amountOut0 of token0 from first swap and amountOut1 of token1 from second swap
        uint256 amountOwed = LowGasSafeMath.add(borrowedAmount, fee);
        require(trade2Amount > amountOwed, "Trade not Profitable");

        TransferHelper.safeApprove(tokenBorrow, address(this), amountOwed);

        // if profitable pay profits to payer
        if (trade2Amount > amountOwed) {
            uint256 profit = LowGasSafeMath.sub(trade2Amount, amountOwed);

            TransferHelper.safeApprove(tokenBorrow, address(this), profit);
            pay(tokenBorrow, address(this), decoded.payer, profit);
        }

        // Payback loan
        if (amountOwed > 0)
            pay(tokenBorrow, address(this), msg.sender, amountOwed);

        console.log(
            "Account Balance After repay: tokenBorrow:  %s",
            IERC20(address(tokenBorrow)).balanceOf(address(this))
        );

        console.log(
            "Balance of Payer:  %s",
            IERC20(address(tokenBorrow)).balanceOf(address(decoded.payer))
        );
    }

    function getTokenBalance(address _token) public view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    //fee1 is the fee of the pool from the initial borrow
    //fee2 is the fee of the first pool to arb from
    //fee3 is the fee of the second pool to arb from
    struct FlashParams {
        address token0;
        address token1;
        address arbToken1;
        address arbToken2;
        uint24 fee1;
        uint256 amount0;
        uint256 amount1;
        uint24 fee2;
        uint24 fee3;
    }
    // fee2 and fee3 are the two other fees associated with the two other pools of token0 and token1
    struct FlashCallbackData {
        uint256 amount0;
        uint256 amount1;
        address arbToken1;
        address arbToken2;
        address payer;
        PoolAddress.PoolKey poolKey;
        uint24 poolFee2;
        uint24 poolFee3;
    }

    /// @param params The parameters necessary for flash and the callback, passed in as FlashParams
    /// @notice Calls the pools flash function with data needed in `uniswapV3FlashCallback`
    function initFlashUniswap(FlashParams memory params) external {
        PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee1
        });
        console.log(
            " pool address: %s",
            PoolAddress.computeAddress(factory, poolKey)
        );

        IUniswapV3Pool pool = IUniswapV3Pool(
            PoolAddress.computeAddress(factory, poolKey)
        );
        // recipient of borrowed amounts
        // amount of token0 requested to borrow
        // amount of token1 requested to borrow
        // need amount 0 and amount1 in callback to pay back pool
        // recipient of flash should be THIS contract
        pool.flash(
            address(this),
            params.amount0,
            params.amount1,
            abi.encode(
                FlashCallbackData({
                    amount0: params.amount0,
                    amount1: params.amount1,
                    arbToken1: params.arbToken1,
                    arbToken2: params.arbToken2,
                    payer: msg.sender,
                    poolKey: poolKey,
                    poolFee2: params.fee2,
                    poolFee3: params.fee3
                })
            )
        );
    }

    function placeTradeUniswap(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) internal returns (uint256) {
        // execute on uniswap
        console.log("amount to trade %s ", _amount);
        // call exactInputSingle for swapping token1 for token0 in pool w/fee2
        uint256 amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _fromToken,
                tokenOut: _toToken,
                fee: 3000,
                recipient: address(this),
                deadline: block.timestamp + 2 days,
                amountIn: _amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        console.log("Amount out from trade %s", amountOut);

        return amountOut;
    }

    function placeTradeSushi(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) internal returns (uint256) {
        // execute on sushiswap
        address pair = IUniswapV2Factory(sushiFactory).getPair(
            _fromToken,
            _toToken
        );
        require(pair != address(0), "There is no Liquidity");
        address[] memory path = new address[](2);
        path[0] = _fromToken;
        path[1] = _toToken;
        uint256 amountsOutMin = IUniswapV2Router01(sushiSwapRouter)
            .getAmountsOut(_amount, path)[1];
        console.log("balance after first swap %s",IERC20(address(_fromToken)).balanceOf(address(this)));
        console.log("minimum amounts out %s",amountsOutMin);

        // call exactInputSingle for swapping token1 for token0 in pool w/fee2
        uint256 amountOut = IUniswapV2Router01(sushiSwapRouter)
            .swapExactTokensForTokens(
                _amount,
                amountsOutMin,
                path,
                address(this),
                block.timestamp + 2 days
            )[1];

        return amountOut;
        // execute on sushi
    }
}
