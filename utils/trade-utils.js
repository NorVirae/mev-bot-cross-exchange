const { ethers } = require("hardhat");

// get return amount on sell exchange
async function fetchReverseSellResult(
  buyExchange,
  firstExchangeInfo,
  secondExchangeInfo,
  maximumAmountOutForFirstEx,
  smallAmountOutForOneQuantityFirstEx,
  maximumAmountOutForSecondEx,
  smallAmountOutForOneQuantitySecondEx
) {

  console.log(buyExchange,
    firstExchangeInfo,
    secondExchangeInfo,
    maximumAmountOutForFirstEx,
    smallAmountOutForOneQuantityFirstEx,
    maximumAmountOutForSecondEx,
    smallAmountOutForOneQuantitySecondEx)
  let returnAmountInfo = {
    amountOut: 0,
    exchangeType: ""
  };
  if (buyExchange == firstExchangeInfo.type) {
    returnAmountInfo.amountOut =
      maximumAmountOutForFirstEx / smallAmountOutForOneQuantitySecondEx;
    returnAmountInfo.exchangeType = firstExchangeInfo.type;
  }

  if (buyExchange == secondExchangeInfo.type) {
    returnAmountInfo.amountOut =
      maximumAmountOutForSecondEx / smallAmountOutForOneQuantityFirstEx;
    returnAmountInfo.exchangeType = secondExchangeInfo.type;
  }

  return returnAmountInfo;
}

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
  let buyfromExchange = "";
  if (
    amountOutInfoFromFirstExchange.amount >
      amountOutInfoFromSecondExchange.amount &&
    calculatedBuyExchange == amountOutInfoFromFirstExchange.exchangeType
  ) {
    buyfromExchange = amountOutInfoFromFirstExchange.type;

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

    let amountOutReversed1 =
      await exchangeSelectorForConclusiveAmountsOutReversed(
        secondExchangeInfo,
        ethers.utils.parseUnits(maximumAmountOutForFirstExTraded, 18)
      );

    console.log(
      " supposed calculated amounts out: ",
      maximumAmountOutForSecondEx / smallAmountOutForOneQuantityFirstEx
    );
  } else {

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


    let amountOutReversed2 =
      await exchangeSelectorForConclusiveAmountsOutReversed(
        firstExchangeInfo,
        ethers.utils.parseUnits(maximumAmountOutForSecondExTraded, 18)
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
    buyExchange = buyExchangeInProspect.type;
  } else {
    return;
  }

  probableTradeReport.type = buyExchange;
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

  // === MAJOR TASK === 4 calculate potential price based on amount to be used on trade for second exchange
  //  x = smallAmountOut * tradeAmount
  maximumAmountOutForSecondEx =
    Number(smallAmountOutForOneQuantitySecondEx) * Number(tradeAmount);
;

  

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

  // === MAJOR TASK === 6 get the possible amounts out from first exchange, slippage applied
  maximumAmountOutForFirstExTraded =
    await exchangeSelectorForConclusiveAmountsOut(firstExchangeInfo);



  // === MAJOR TASK === 7 get the possible amounts out from second exchange, slippage applied
  maximumAmountOutForSecondExTraded =
    await exchangeSelectorForConclusiveAmountsOut(secondExchangeInfo);


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

module.exports = {
  checkProfitableBuyExchange,
  fetchReverseSellResult,
  checkProfitabilityCrossExchange,
  exchangeSelectorForSingularPriceOutput,
  exchangeSelectorForConclusiveAmountsOut,
  exchangeSelectorForConclusiveAmountsOutReversed,
  getMostProfitableExchangeByComparison,
  getMostProfitableExchangeByComparisonTraded,
  slippageAmountCalculator,
  compareAmountsOutWithSlipage,
  fetchSlippagePercentageAndAmount,
  compareAmountsWithoutSlippage,
  checkProfitableBuyExchange,
};
