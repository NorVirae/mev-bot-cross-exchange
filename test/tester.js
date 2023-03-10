const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { impersonateFundErc20 } = require("../utils/utilities");

const {
  abi,
} = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");

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
    txArbitrage;

  const DECIMALS = 6;

  const USDC_WHALE = "0x9810762578aCCF1F314320CCa5B72506aE7D7630";
  const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  const LINK = "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39";
  const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
  const BASE_TOKEN_ADDRESS = USDC;

  const tokenBase = new ethers.Contract(BASE_TOKEN_ADDRESS, abi, provider);

  beforeEach(async () => {
    // Get owner as signer
    const [owner] = await ethers.getSigners();

    // Ensure that the WHALE has a balance
    const whale_balance = await provider.getBalance(USDC_WHALE);
    console.log(whale_balance);
    // expect(whale_balance).not.equal("0");

    const amountToBorrowInHuman = "10000";
    BORROW_AMOUNT = ethers.utils.parseUnits(amountToBorrowInHuman, DECIMALS);
    console.log(BORROW_AMOUNT.toString(), "HEYA");
    initialFundingHuman = "10000";
    FUND_AMOUNT = ethers.utils.parseUnits(initialFundingHuman, DECIMALS);
    const flashSwapFactory = await ethers.getContractFactory(
      "UniswapCrossFlash"
    );
    FLASHSWAP = await flashSwapFactory.deploy();
    await FLASHSWAP.deployed();

    const flashSwapV3Swap = await ethers.getContractFactory(
      "UniswapV3CrossFlash"
    );

    FLASHSWAPV3 = await flashSwapV3Swap.deploy(_swapRouter, _factory, _WETH9);
    await FLASHSWAPV3.deployed();

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
      const params = {
        token0: USDC ,
        token1: WETH,
        fee1: 3000,
        amount0: 0,
        amount1: BORROW_AMOUNT,
        fee2: 3000,
        fee3: 3000,
      };
      await FLASHSWAPV3.initFlash(params);
    });
  });

  describe("Arbitrage Execution", () => {
    it("ensures contract is funded", async () => {
      const tokenBalance = await FLASHSWAP.getFlashContractBalance(
        BASE_TOKEN_ADDRESS
      );

      const tokenBalances = await FLASHSWAP.getPairBalance();

      const tokenBalanceInHuman = ethers.utils.formatUnits(
        tokenBalance,
        DECIMALS
      );
      expect(Number(tokenBalanceInHuman)).equal(Number(initialFundingHuman));
    });

    it("it should check exchange to buy from ", async () => {
      const buyExchange = await FLASHSWAP.checkSwapBuyLocation(
        BORROW_AMOUNT,
        USDC,
        LINK
      );
      console.log(buyExchange);
      expect(buyExchange).not.equal("");
    });

    it("excutes an arbitrage", async () => {
      txArbitrage = await FLASHSWAP.startLoan(USDC, BORROW_AMOUNT);

      const balanceAfterArbitrage = await FLASHSWAP.getFlashContractBalance(
        BASE_TOKEN_ADDRESS
      );
      const formattedAmount = ethers.utils.formatUnits(
        balanceAfterArbitrage,
        DECIMALS
      );

      const currentBalance = await FLASHSWAP.getFlashContractBalance(
        BASE_TOKEN_ADDRESS
      );

      const currentBalanceLINK = await FLASHSWAP.getFlashContractBalance(LINK);

      assert(txArbitrage);
    });

    it("provides GAS output", async () => {
      const txReceipt = await provider.getTransactionReceipt(txArbitrage.hash);
      const effGasPrice = txReceipt.effectiveGasPrice;
      const txGasUsed = txReceipt.gasUsed;
      const gasUsedEth = effGasPrice + txGasUsed;

      console.log(
        "Total Gas USED: " +
          ethers.utils.formatEther(gasUsedEth.toString()) * 2900
      );
      expect(gasUsedEth).not.equal(0);
    });
  });
});
