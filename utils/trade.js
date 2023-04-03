const { ethers } = require("hardhat");

// checks profitabilty after swap from first exchange
async function checkProfitabilityCrossExchange(
  initialTradeAmount,
  tradeAmountOutFirstExchange,
  toExchangeInfo
) {
  // use amounts out from profitable exchange and trade on second

  if (toExchangeInfo.type == "uniswap") {
    let tradeOutcome = {
      profitable: false,
      amountOut: "",
      type: "",
    };
    let returnAmount =
      await toExchangeInfo.contractInstance.callStatic.quoteExactInputSingle(
        toExchangeInfo.params.to,
        toExchangeInfo.params.from,
        toExchangeInfo.params.fee,
        ethers.utils.parseUnits(tradeAmountOutFirstExchange, 18),
        0
      );

    tradeOutcome.amountOut = returnAmount;
    tradeOutcome.type = toExchangeInfo.type;

    if (
      Number(ethers.utils.formatUnits(returnAmount, 6)) >
      Number(initialTradeAmount) + (initialTradeAmount * 3) / 997 + 1
    ) {
      tradeOutcome.profitable = true;
    }

    return tradeOutcome;
  }

  if (toExchangeInfo.type == "sushiswap") {
    let tradeOutcome = {
      profitable: false,
      amountOut: "",
    };
    let returnAmount = await exchange.contractInstance.getAmountsOut(
      ethers.utils.parseUnits(tradeAmountOutFirstExchange, 6),
      [exchange.params.to, exchange.params.from]
    );

    tradeOutcome.amountOut = returnAmount[1];
    tradeOutcome.type = toExchangeInfo.type;

    // check outpute amount is greater than input trade amount + fee

    if (
      Number(ethers.utils.formatUnits(returnAmount[1], 6)) >
      Number(initialTradeAmount) + (initialTradeAmount * 3) / 997 + 1
    ) {
      tradeOutcome.profitable = true;
    }

    return tradeOutcome;
  }
}

async function exchangeSelectorForSingularPriceOutput(exchange) {
  if (exchange.type == "uniswap") {
    let smallestAmountOut =
      await exchange.contractInstance.callStatic.quoteExactInputSingle(
        exchange.params.from,
        exchange.params.to,
        exchange.params.fee,
        ethers.utils.parseUnits("1", 6),
        0
      );

    return ethers.utils.formatUnits(smallestAmountOut, 18);
  }

  if (exchange.type == "sushiswap") {
    let smallestAmountOut = await exchange.contractInstance.getAmountsOut(
      ethers.utils.parseUnits("1", 6),
      [exchange.params.from, exchange.params.to]
    );

    return ethers.utils.formatUnits(smallestAmountOut[1], 18);
  }
}

async function exchangeSelectorForConclusiveAmountsOut(exchange) {
  if (exchange.type == "uniswap") {
    let amountsOut =
      await exchange.contractInstance.callStatic.quoteExactInputSingle(
        exchange.params.from,
        exchange.params.to,
        exchange.params.fee,
        ethers.utils.parseUnits(exchange.params.amount, 6),
        0
      );
    return ethers.utils.formatUnits(amountsOut, 18);
  }

  if (exchange.type == "sushiswap") {
    let amountsOut = await exchange.contractInstance.getAmountsOut(
      ethers.utils.parseUnits(exchange.params.amount, 6),
      [exchange.params.from, exchange.params.to]
    );

    return ethers.utils.formatUnits(amountsOut[1], 18);
  }
}

async function exchangeSelectorForConclusiveAmountsOutReversed(
  exchange,
  amount
) {
  if (exchange.type == "uniswap") {
    let amountsOut =
      await exchange.contractInstance.callStatic.quoteExactInputSingle(
        exchange.params.to,
        exchange.params.from,
        exchange.params.fee,
        amount,
        0
      );
    return ethers.utils.formatUnits(amountsOut, 6);
  }

  if (exchange.type == "sushiswap") {
    let amountsOut = await exchange.contractInstance.getAmountsOut(amount, [
      exchange.params.to,
      exchange.params.from,
    ]);

    return ethers.utils.formatUnits(amountsOut[1], 6);
  }
}

async function getMostProfitableExchangeByComparison(
  amountInfoFromFirstEx,
  amountInfoFromSecondEx
) {
  if (amountInfoFromFirstEx.amount > amountInfoFromSecondEx.amount) {
    return amountInfoFromFirstEx.exchangeType;
  }

  return amountInfoFromSecondEx.exchangeType;
}

async function getMostProfitableExchangeByComparisonTraded(
  amountOutInfoFromFirstExchange,
  amountOutInfoFromSecondExchange,
  calculatedBuyExchange
) {
  console.log(calculatedBuyExchange, "Exchange Buy calculated");
  let buyfromExchange = "";
  if (
    amountOutInfoFromFirstExchange.amount >
      amountOutInfoFromSecondExchange.amount &&
    calculatedBuyExchange == amountOutInfoFromFirstExchange.exchangeType
  ) {
    buyfromExchange = amountOutInfoFromFirstExchange.type;
    console.log(buyfromExchange, "Exchange Buy Traded");

    return {
      type: buyfromExchange,
      amountsOut: amountOutInfoFromFirstExchange.amount,
    };
  } else if (
    amountOutInfoFromSecondExchange.amount >
      amountOutInfoFromFirstExchange.amount &&
    calculatedBuyExchange == amountOutInfoFromSecondExchange.exchangeType
  ) {
    buyfromExchange = amountOutInfoFromSecondExchange.type;
    return {
      type: buyfromExchange,
      amountsOut: amountOutInfoFromSecondExchange.amount,
    };
  } else {
    console.error(
      "exchange amount for most profitable exchange has high slippage"
    );
    return -1;
  }
}

async function slippageAmountCalculator(firstAmount, secondAmount) {
  let slipPercent = 0;
  let slipAmount = 0;

  // second amount is price affected by slippage
  slipAmount = firstAmount - secondAmount;
  console.log("Amount lost due to slippage: ", slipAmount);

  // slip percentage
  slipPercent = (slipAmount / firstAmount) * 100;
  console.log("slippage percentage: ", slipPercent);
  return {
    slipAmount,
    slipPercent,
  };
}

// compare amounts out with slippage
function compareAmountsOutWithSlipage(buyExchangeInProspect, tradeAmount, fee) {
  let buyExchange;
  if (buyExchangeInProspect.amountsOut > tradeAmount + fee) {
    console.log("exchange is profitable with slippage applied");
    return (buyExchange = buyExchangeInProspect.type);
  } else {
    console.log("exchange is not profitable with slippage applied");
    return;
  }
}

// get slippage percentage and amount

async function fetchSlippagePercentageAndAmount(
  buyExchangeInProspect,
  firstExchangeInfo,
  maximumAmountOutForFirstEx,
  maximumAmountOutForFirstExTraded,
  secondExchangeInfo,
  maximumAmountOutForSecondEx,
  smallAmountOutForOneQuantityFirstEx,
  smallAmountOutForOneQuantitySecondEx,
  maximumAmountOutForSecondExTraded,
  tradeAmount
) {
  let probableTradeReport;
  if (buyExchangeInProspect.type == firstExchangeInfo.type) {
    console.log("UNI WTH SLIPPAGE");
    slippageInfo = slippageAmountCalculator(
      maximumAmountOutForFirstEx,
      maximumAmountOutForFirstExTraded
    );

    // write a function to check trade profitability accross exchange
    probableTradeReport = await checkProfitabilityCrossExchange(
      tradeAmount,
      maximumAmountOutForFirstExTraded,
      secondExchangeInfo
    );

    console.log(probableTradeReport, "TRADE REPORT PROBABLE UNISWAP");
    let amountOutReversed1 =
      await exchangeSelectorForConclusiveAmountsOutReversed(
        secondExchangeInfo,
        ethers.utils.parseUnits(maximumAmountOutForFirstExTraded, 18)
      );

    console.log("amount out from sushi after uni buy: ", amountOutReversed1);

    // Model for calculatively converting eth to usdc
    // 1usdc = small eth
    // x = maxiEth
    // x = maxiEth / small eth

    // highly traded dexes on polygon
    // uniswapv3, Quickswap(V3), Kyberswap Elastic, DODO

    console.log(
      " supposed calculated amounts out: ",
      maximumAmountOutForFirstEx / smallAmountOutForOneQuantitySecondEx
    );

    console.log(
      " supposed calculated amounts out: ",
      maximumAmountOutForSecondEx / smallAmountOutForOneQuantityFirstEx
    );
    console.log("GOT HERE!");
  } else {
    console.log("SUSHI WTH SLIPPAGE");

    slippageInfo = await slippageAmountCalculator(
      maximumAmountOutForSecondEx,
      maximumAmountOutForSecondExTraded
    );

    // write a function to check trade profitability
    probableTradeReport = await checkProfitabilityCrossExchange(
      tradeAmount,
      maximumAmountOutForSecondExTraded,
      firstExchangeInfo
    );

    console.log(probableTradeReport, "TRADE REPORT PROBABLE SUSHI");

    let amountOutReversed2 =
      await exchangeSelectorForConclusiveAmountsOutReversed(
        firstExchangeInfo,
        ethers.utils.parseUnits(maximumAmountOutForSecondExTraded, 18)
      );
    console.log("HOLA");

    console.log("amount out from uni after sushi buy: ", amountOutReversed2);

    console.log(
      " supposed calculated amounts out: ",
      maximumAmountOutForSecondEx / smallAmountOutForOneQuantityFirstEx
    );
    console.log(
      " supposed calculated amounts out: ",
      maximumAmountOutForFirstEx / smallAmountOutForOneQuantitySecondEx
    );
  }

  return probableTradeReport;
}

// compare amounts without slippage

async function compareAmountsWithoutSlippage(
  buyExchangeInProspect,
  tradeAmount,
  slippageInfo,
  fee
) {
  if (
    buyExchangeInProspect.amountsOut + slippageInfo.slipAmount >
    Number(tradeAmount) + fee
  ) {
    console.log("exchange is profitable with slippage removed");
    buyExchange = buyExchangeInProspect.type;
  } else {
    console.log("exchange is not profitable with slippage removed");
    return;
  }

  console.log("HUZARON");
  probableTradeReport.type = buyExchange;
  console.log(probableTradeReport, "CHECK^^^^^^^^^^");
}

// PSSS check Trade Report
// function to check profitability
async function checkProfitableBuyExchange(
  firstExchangeInfo,
  secondExchangeInfo,
  tradeAmount,
  fee
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
  let buyExchangeInProspect = { exchangeType: "", amountsOut: 0 };
  let smallAmountOutForOneQuantityFirstEx = 0;
  let smallAmountOutForOneQuantitySecondEx = 0;
  let maximumAmountOutForFirstEx = 0;
  let maximumAmountOutForSecondEx = 0;
  let maximumAmountOutForFirstExTraded = 0;
  let maximumAmountOutForSecondExTraded = 0;
  // ===MAJOR TASK=== 1 get the smallest unit price from first exchange
  // ---- 1 usdc == how many weth
  smallAmountOutForOneQuantityFirstEx =
    await exchangeSelectorForSingularPriceOutput(firstExchangeInfo);

  // === MAJOR TASK === 2 get the smallest unit price from second exchange
  smallAmountOutForOneQuantitySecondEx =
    await exchangeSelectorForSingularPriceOutput(secondExchangeInfo);

  // === MAJOR TASK === 3 calculate potential price based on amount to be used on trade for first exchange
  //  x = smallAmountOut * tradeAmount
  maximumAmountOutForFirstEx =
    Number(smallAmountOutForOneQuantityFirstEx) * Number(tradeAmount);
  console.log(maximumAmountOutForFirstEx, "amount out from uniswap for 100k");

  // === MAJOR TASK === 4 calculate potential price based on amount to be used on trade for second exchange
  //  x = smallAmountOut * tradeAmount
  maximumAmountOutForSecondEx =
    Number(smallAmountOutForOneQuantitySecondEx) * Number(tradeAmount);
  console.log(
    maximumAmountOutForSecondEx,
    "amount out from sushiswap for 100k"
  );

  console.log(
    "possible profit difference ",
    maximumAmountOutForFirstEx > maximumAmountOutForSecondEx
      ? maximumAmountOutForFirstEx - maximumAmountOutForSecondEx
      : maximumAmountOutForSecondEx - maximumAmountOutForFirstEx
  );

  // === MAJOR TASK === 5 get the most profitable exchange
  calculatedBuyExchange = await getMostProfitableExchangeByComparison(
    {
      exchangeType: firstExchangeInfo.type,
      amount: maximumAmountOutForFirstEx,
    },
    {
      exchangeType: secondExchangeInfo.type,
      amount: maximumAmountOutForSecondEx,
    }
  );

  console.log(calculatedBuyExchange, "- BUY EXCHANGE");
  // === MAJOR TASK === 6 get the possible amounts out from first exchange, slippage applied
  maximumAmountOutForFirstExTraded =
    await exchangeSelectorForConclusiveAmountsOut(firstExchangeInfo);

  console.log(
    maximumAmountOutForFirstExTraded,
    "amount out from uniswap for 100k TRADED"
  );

  // === MAJOR TASK === 7 get the possible amounts out from second exchange, slippage applied
  maximumAmountOutForSecondExTraded =
    await exchangeSelectorForConclusiveAmountsOut(secondExchangeInfo);

  // reversed Trade convert

  console.info(
    maximumAmountOutForSecondExTraded,
    "amount out from sushi for 100k TRADED"
  );

  // === MAJOR TASK === 8 compare prices from 6 and 7 if most profitable exchanges equals the one from 5 move to next step else go to log 1
  buyExchangeInProspect = getMostProfitableExchangeByComparisonTraded(
    {
      exchangeType: firstExchangeInfo.type,
      amount: maximumAmountOutForFirstExTraded,
    },
    {
      exchangeType: secondExchangeInfo.type,
      amount: maximumAmountOutForSecondExTraded,
    },
    calculatedBuyExchange
  );

  if (buyExchangeInProspect == -1) {
    return;
  }

  // === MAJOR TASK === 9 get the percentage and amounts lost due to slippage
  probableTradeReport = await fetchSlippagePercentageAndAmount(
    buyExchangeInProspect,
    firstExchangeInfo,
    maximumAmountOutForFirstEx,
    maximumAmountOutForFirstExTraded,
    secondExchangeInfo,
    maximumAmountOutForSecondEx,
    smallAmountOutForOneQuantityFirstEx,
    smallAmountOutForOneQuantitySecondEx,
    maximumAmountOutForSecondExTraded
  );

  // === MAJOR TASK === 10 compare the amounts out from 8 plus slippage, check if amount is greater than initial investment plus fee goto log 2 else go to log 4

  buyExchange = await compareAmountsOutWithSlipage(
    buyExchangeInProspect,
    tradeAmount,
    fee
  );

  console.log(tradeAmount, "TRADE AMOUNT");
  // === MAJOR TASK === 11 compare the amounts out from 8 minus slippage, check if amount is greater than initial investment plus fee goto log 3 else got to log 5
  await compareAmountsWithoutSlippage(
    buyExchangeInProspect,
    tradeAmount,
    slippageInfo,
    fee
  );
  // === MAJOR TASK === 12 if 10 is profitable return that exchange as the buy exchange and second exchange as the sell exchange
  return probableTradeReport;
}

const executeTrade = async (
  tradeReport,
  crossFlashContract,
  params
) => {
  
  if (tradeReport.profitable) {
    await crossFlashContract.initFlashUniswap(params);
  }
  else{
    console.log("couldn't execute trade is not profitable!")
  }
};

module.exports = {
  checkProfitableBuyExchange,
  executeTrade,
};
