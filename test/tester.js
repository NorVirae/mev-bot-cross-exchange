const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { impersonateFundErc20 } = require("../utils/utilities");
const { computePoolAddress } = require("@uniswap/v3-sdk");

const { SupportedChainId, Token } = require("@uniswap/sdk-core");
const sushiAbi = require("../utils/abi/sushiRouter.json");
const uniswapRouterAbi = require("../utils/abi/uniswapRouter.json");
const usdcAbi = require("../utils/abi/UsdcAbi.json");

const {
  abi,
} = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");
const IUniswapV3PoolABI = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const Quoter = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json");

const provider = waffle.provider;

describe("FlashSwap Contract", () => {
  let FLASHSWAP,
    FLASHSWAPV3,
    BORROW_AMOUNT,
    FUND_AMOUNT,
    initialFundingHuman,
    _swapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    _factory = "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    _WETH9 = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    _sushiSwapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    txArbitrage;

  const DECIMALS = 6;
  const BUSD = "0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39";

  // whales
  const BUSD_WHALE = "0x5da11e3cad7d192dfc69ea84fe5c11071b2b66c5";
  const USDC_WHALE = "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245";
  const WETH_WHALE = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
  const WMATIC_WHALE = "0xba12222222228d8ba445958a75a0704d566bf2c8";

  const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  const DAI = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
  const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
  const LINK = "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39";
  const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
  const BASE_TOKEN_ADDRESS = USDC;

  const tokenBase = new ethers.Contract(BASE_TOKEN_ADDRESS, abi, provider);

  async function exchangeSelectorForPriceOutput(exchange) {
    let smallestAmountOut = 0;

    if (exchange.type == "uniswap") {
      smallestAmountOut = await exchange.contractInstance.quoteExactInputSingle(
        exchange.params
      );
    }

    if (exchange.type == "sushiswap") {
      smallestAmountOut = await exchange.contractInstance.getAmountsOut(
        exchange.params
      );
    }

    return smallestAmountOut;
  }

  async function getMostProfitableExchangeByComparison(
    amountInfoFromFirstEx,
    amountInfoFromSecondEx
  ) {
    if (amountInfoFromFirstEx.amount > amountInfoFromSecondEx.amount) {
      return amountInfoFromFirstEx.name;
    }

    return amountInfoFromSecondEx.name;
  }

  async function checkProfitableBuyExchange(
    firstExchangeInfo,
    secondExchangeInfo,
    tradeAmount
  ) {
    // logs
    // log 1 - exchange amount for most profitable exchange has high slippage, return
    // log 2 - exchange is profitable with slippage applied
    // log 3 - exchange is profitable with slippage removed
    // log 4 - opposite of log 2
    // log 5 - opposite of log 3

    // 0 exchange to buy variable
    let calculatedBuyExchange = "";
    let buyExchange = "uniswap";
    const smallAmountOutForOneQuantityFirstEx = 0;
    const smallAmountOutForOneQuantitySecondEx = 0;
    let maximumAmountOutForFirstEx = 0;
    let maximumAmountOutForSecondEx = 0;
    // ===MAJOR TASK=== 1 get the smallest unit price from first exchange
    // ---- 1 usdc == how many weth

    smallAmountOutForOneQuantityFirstEx = await exchangeSelectorForPriceOutput(
      firstExchangeInfo
    );

    // === MAJOR TASK === 2 get the smallest unit price from second exchange
    smallAmountOutForOneQuantitySecondEx = await exchangeSelectorForPriceOutput(
      secondExchangeInfo
    );

    // === MAJOR TASK === 3 calculate potential price based on amount to be used on trade for first exchange
    //  x = smallAmountOut * tradeAmount
    maximumAmountOutForFirstEx =
      smallAmountOutForOneQuantityFirstEx * tradeAmount;

    // === MAJOR TASK === 4 calculate potential price based on amount to be used on trade for second exchange
    //  x = smallAmountOut * tradeAmount
    maximumAmountOutForSecondEx =
      smallAmountOutForOneQuantitySecondEx * tradeAmount;

    // === MAJOR TASK === 5 get the most profitable exchange
    calculatedBuyExchange = getMostProfitableExchangeByComparison({
      exchangeType: firstExchangeInfo.type,
      amount: maximumAmountOutForFirstEx,
    }, {
      exchangeType: secondExchangeInfo.type,
      amount: maximumAmountOutForSecondEx,
    });
    // === MAJOR TASK === 6 get the possible amounts out from first exchange, slippage applied
    // === MAJOR TASK === 7 get the possible amounts out from second exchange, slippage applied
    // === MAJOR TASK === 8 compare prices from 6 and 7 if most profitable exchanges equals the one from 5 move to next step else go to log 1
    // === MAJOR TASK === 9 get the percentage and amounts lost due to slippage
    // === MAJOR TASK === 10 compare the amounts out from 8 plus slippage, check if amount is greater than initial investment plus fee goto log 2 else go to log 4
    // === MAJOR TASK === 11 compare the amounts out from 8 minus slippage, check if amount is greater than initial investment plus fee goto log 3 else got to log 5
    // === MAJOR TASK === 12 if 10 is profitable set that exchange as the buy exchange and second exchange as the sell exchange
  }

  beforeEach(async () => {
    // Get owner as signer
    const [owner] = await ethers.getSigners();

    // Ensure that the WHALE has a balance
    const whale_balance = await provider.getBalance(WMATIC_WHALE);
    // expect(whale_balance).not.equal("0");

    const amountToBorrowInHuman = "100000";
    BORROW_AMOUNT = ethers.utils.parseUnits(amountToBorrowInHuman, DECIMALS);
    initialFundingHuman = "200000";
    FUND_AMOUNT = ethers.utils.parseUnits(initialFundingHuman, DECIMALS);
    const flashSwapFactory = await ethers.getContractFactory(
      "UniswapCrossFlash"
    );
    FLASHSWAP = await flashSwapFactory.deploy();
    await FLASHSWAP.deployed();

    const flashSwapV3Swap = await ethers.getContractFactory(
      "UniswapV3CrossFlash"
    );

    FLASHSWAPV3 = await flashSwapV3Swap.deploy(
      _swapRouter,
      _factory,
      _WETH9,
      _sushiSwapRouter
    );
    await FLASHSWAPV3.deployed();
    await impersonateFundErc20(
      tokenBase,
      USDC_WHALE,
      owner.address,
      initialFundingHuman,
      DECIMALS
    );
    await impersonateFundErc20(
      tokenBase,
      USDC_WHALE,
      FLASHSWAP.address,
      initialFundingHuman,
      DECIMALS
    );

    await impersonateFundErc20(
      tokenBase,
      USDC_WHALE,
      FLASHSWAPV3.address,
      initialFundingHuman,
      DECIMALS
    );
  });

  describe("Uniswap V3 cross Exchange arbitrage", () => {
    it("should return router address", async () => {
      let router = await FLASHSWAPV3.swapRouter();
      console.log(router);
      expect(router).equal(_swapRouter);
    });

    it("should call flash", async () => {
      // Token
      const WETH_TOKEN = new Token(
        SupportedChainId.POLYGON,
        WETH,
        18,
        "WETH",
        "Wrapped Ether"
      );

      const WMATIC_TOKEN = new Token(
        SupportedChainId.POLYGON,
        WMATIC,
        18,
        "WMATIC",
        "Wrapped Matic"
      );

      const USDC_TOKEN = new Token(
        SupportedChainId.POLYGON,
        USDC,
        6,
        "USDC",
        "USD//C"
      );
      // compute pool address
      const config = {
        tokens: {
          in: USDC_TOKEN,
          amountIn: BORROW_AMOUNT,
          out: WETH_TOKEN,
          poolFee: 3000,
        },
      };

      const currentPoolAddress = computePoolAddress({
        factoryAddress: _factory,
        tokenA: config.tokens.in,
        tokenB: config.tokens.out,
        fee: config.tokens.poolFee,
      });

      const provider = new ethers.providers.JsonRpcProvider(
        "https://polygon-mainnet.g.alchemy.com/v2/N8cyw-7E92FP1U7--nwsBLZX4HOhz9Wl"
      );

      const poolContract = new ethers.Contract(
        currentPoolAddress,
        IUniswapV3PoolABI.abi,
        provider
      );

      // call tokens and fees
      const [token0, token1, fee] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
      ]);

      // create quoter contract instance
      const quoterContractAddress =
        "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
      const quoterContract = new ethers.Contract(
        quoterContractAddress,
        Quoter.abi,
        provider
      );
      const [person] = await ethers.getSigners();
      const uniswapV3RouterContract = new ethers.Contract(
        _swapRouter,
        uniswapRouterAbi,
        person
      );

      const sushiContract = new ethers.Contract(
        _sushiSwapRouter,
        sushiAbi,
        provider
      );

      const tokenContract = new ethers.Contract(
        BASE_TOKEN_ADDRESS,
        abi,
        person
      );

      await impersonateFundErc20(
        tokenBase,
        USDC_WHALE,
        person.address,
        initialFundingHuman,
        DECIMALS
      );
      const YFI = "0xDA537104D6A5edd53c6fBba9A898708E465260b6";
      const usdcBalance = await tokenContract.balanceOf(person.address);
      console.log(
        "usdc balance: ",
        ethers.utils.formatUnits(usdcBalance, 6),
        person.address
      );

      // get quotes
      const quotedAmountOut =
        await quoterContract.callStatic.quoteExactInputSingle(
          USDC,
          WETH,
          fee,
          ethers.utils.parseUnits("1", 6),
          0
        );

      // calculate proper amounts out for ethereum
      // 1USDC -> quotedAmount WETH
      // 100,000USDC => xWETH
      // x = 100,000USDC * quotedAmount

      const supposedWethOut =
        100000 * ethers.utils.formatUnits(quotedAmountOut, 18);
      console.log("Expected Amount Out: ", supposedWethOut);

      const quotedAmountOutWETHReal =
        await quoterContract.callStatic.quoteExactInputSingle(
          USDC,
          WETH,
          fee,
          ethers.utils.parseUnits("100000", 6),
          0
        );

      console.log(
        "Amount out from Exchange: ",
        ethers.utils.formatUnits(quotedAmountOutWETHReal, 18)
      );

      await tokenContract.approve(
        _swapRouter,
        ethers.utils.parseUnits("100000", 6)
      );

      // perform swap on uniswap
      const realTradedAmount = await FLASHSWAPV3.exactInput({
        tokenIn: USDC,
        tokenOut: WETH,
        fee: 3000,
        recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        deadline: Date.now() + 10000,
        amountIn: ethers.utils.parseUnits("100000", 6),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      });

      const confirmationTx = await realTradedAmount.wait();

      const realTradeAmount = await FLASHSWAPV3.getTransactionFinalPrice();

      console.log(
        "Amount from real trade: ",
        ethers.utils.formatUnits(realTradeAmount, 18)
      );

      const quotedAmountOut2 =
        await quoterContract.callStatic.quoteExactInputSingle(
          WETH,
          USDC,
          fee,
          quotedAmountOut,
          0
        );

      const wethAmount = await sushiContract.getAmountsOut(
        ethers.utils.parseUnits("10", 6),
        [USDC, WETH]
      );

      const usdcAmount = await sushiContract.getAmountsOut(wethAmount[1], [
        WETH,
        USDC,
      ]);

      const params = {
        token0: WMATIC,
        token1: USDC,
        arbToken1: USDC,
        arbToken2: WETH,
        fee1: 3000,
        amount0: ethers.utils.parseUnits("0", 18),
        amount1: BORROW_AMOUNT,
        fee2: 3000,
        fee3: 3000,
        buyType: 0, // 1 buy uniswap
      };
      await FLASHSWAPV3.initFlashUniswap(params);
    }).timeout(10000000);
  });
});
