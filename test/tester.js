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
const { checkProfitableBuyExchange, executeTrade } = require("../utils/trade");

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
    _quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
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

  // exchanges to integrate
  // balancer_v1, uniswap_v2, uniswap_v3, curve, 0x, bancor, quickswap

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

    // fund singer account
    await impersonateFundErc20(
      tokenBase,
      USDC_WHALE,
      owner.address,
      initialFundingHuman,
      DECIMALS
    );

    // fund sniper contract
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
      // MAJOR - setup all variables
      let firstExchangeInfo = {
        type: null,
        contractInstance: null,
        params: null
      }

      let secondExchangeInfo = {
        type: null,
        contractInstance: null,
        params: null
      }


      // MAJOR - set up all contracts
      // create signer
      const [person] = await ethers.getSigners()

      // uniswap router contract
      const uniswapRouterContract = new ethers.Contract(_swapRouter, uniswapRouterAbi, provider)

      // quoter contract
      const uniswapQuoterContract = new ethers.Contract(_quoterAddress, Quoter.abi, provider)

      // token contract
      const baseTokenContract = new ethers.Contract(BASE_TOKEN_ADDRESS, abi, provider)
      // sushiswap router contract
      const sushiswapRouterContract = new ethers.Contract(_sushiSwapRouter, sushiAbi, provider)



      // add exchange contract
      firstExchangeInfo = {
        type: "uniswap",
        contractInstance: uniswapQuoterContract,
        params: {
          from: USDC,
          to: WETH,
          fee: 3000,
          amount: "10000",
          sqrtPrice: 0
        }
      }


      secondExchangeInfo = {
        type: "sushiswap",
        contractInstance: sushiswapRouterContract,
        params: {
          from: USDC,
          to: WETH,
          fee: 3000,
          amount: "10000",
          sqrtPrice: 0
        }
      }


      // MAJOR - check which exchange is profitable to  to buy from which to sell
      // call checkProfitableBuyExchange()
      const tradeProfitabilityReport = await checkProfitableBuyExchange(firstExchangeInfo, secondExchangeInfo, "10000", 3000)
      await executeTrade(tradeProfitabilityReport, firstExchangeInfo, secondExchangeInfo)
      console.log(tradeProfitabilityReport, "HULI")

      // MAJOR - execute trade
      //  call execute trade with swap type

    }).timeout(10000000);
  });
});
