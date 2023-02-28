const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { impersonateFundErc20 } = require("../utils/utilities");

const {
  abi,
} = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");

const provider = waffle.provider;

describe("FlashSwap Contract", () => {
  let FLASHSWAP, BORROW_AMOUNT, FUND_AMOUNT, initialFundingHuman, txArbitrage;

  const DECIMALS = 6;

  const USDC_WHALE = "0x78605df79524164911c144801f41e9811b7db73d";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  const BASE_TOKEN_ADDRESS = USDC;

  const tokenBase = new ethers.Contract(BASE_TOKEN_ADDRESS, abi, provider);

  beforeEach(async () => {
    // Get owner as signer
    const [owner] = await ethers.getSigners();

    // Ensure that the WHALE has a balance
    const whale_balance = await provider.getBalance(USDC_WHALE);
    console.log(whale_balance);
    expect(whale_balance).not.equal("0");

    const amountToBorrowInHuman = "1";
    BORROW_AMOUNT = ethers.utils.parseUnits(amountToBorrowInHuman, DECIMALS);
    initialFundingHuman = "10";
    FUND_AMOUNT = ethers.utils.parseUnits(initialFundingHuman, DECIMALS);
    const flashSwapFactory = await ethers.getContractFactory(
      "UniswapCrossFlash"
    );
    FLASHSWAP = await flashSwapFactory.deploy();
    await FLASHSWAP.deployed();

    await impersonateFundErc20(
      tokenBase,
      USDC_WHALE,
      FLASHSWAP.address,
      initialFundingHuman,
      DECIMALS
    );
  });

  describe("Arbitrage Execution", () => {
    it("ensures contract is funded", async () => {
      const tokenBalance = await FLASHSWAP.getFlashContractBalance(
        BASE_TOKEN_ADDRESS
      );

      const tokenBalances = await FLASHSWAP.getPairBalance();
      console.log(
        "CHECK THIS ",
        ethers.utils.formatUnits(tokenBalances[0], DECIMALS),
        ethers.utils.formatUnits(tokenBalances[1], DECIMALS),
        ethers.utils.formatUnits(tokenBalances[2], DECIMALS),
        ethers.utils.formatUnits(tokenBalances[3], DECIMALS),
        tokenBalances[3].toString(),
        " CHECK THIS"
      );
      const tokenBalanceInHuman = ethers.utils.formatUnits(
        tokenBalance,
        DECIMALS
      );
      expect(Number(tokenBalanceInHuman)).equal(Number(initialFundingHuman));
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

      console.log("USDC: ", ethers.utils.formatUnits(currentBalance, DECIMALS));
      console.log(
        "LINK: ",
        ethers.utils.formatUnits(currentBalanceLINK, DECIMALS)
      );

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
