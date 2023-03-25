async function exchangeSelectorForPriceOutput(exchange) {
    let smallestAmountOut = 0;

    if (exchange.type == "uniswap") {
      smallestAmountOut = await exchange.contractInstance.callStatic.quoteExactInputSingle(
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

  async function exchangeSelectorForConclusiveAmountsOut(exchange, params) {
    let amountsOut = 0;
    if (exchange.type == "uniswap") {
      amountsOut = await exchange.contractInstance.callStatic.quoteExactInputSingle(
        params
      );
    }

    if (exchange.type == "sushiswap") {
      amountsOut = await exchange.contractInstance.getAmountsOut(params);
    }
    return amountsOut;
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
      amountOutInfoFromFirstExchange.amount >
        amountOutInfoFromSecondExchange.amount &&
      calculatedBuyExchange == amountOutInfoFromFirstExchange.exchangeType
    ) {
      buyfromExchange = amountOutInfoFromSecondExchange.type;
      return {
        type: buyfromExchange,
        amountsOut: amountOutInfoFromSecondExchange.amount,
      };
    } else {
      console.log(
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
      slipPercent
    }
  }

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
    const smallAmountOutForOneQuantityFirstEx = 0;
    const smallAmountOutForOneQuantitySecondEx = 0;
    let maximumAmountOutForFirstEx = 0;
    let maximumAmountOutForSecondEx = 0;
    let maximumAmountOutForFirstExTraded = 0;
    let maximumAmountOutForSecondExTraded = 0;
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
    calculatedBuyExchange = getMostProfitableExchangeByComparison(
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
    maximumAmountOutForFirstExTraded = exchangeSelectorForConclusiveAmountsOut(
      firstExchangeInfo,
      firstExchangeInfo.params
    );
    // === MAJOR TASK === 7 get the possible amounts out from second exchange, slippage applied
    maximumAmountOutForSecondExTraded = exchangeSelectorForConclusiveAmountsOut(
      secondExchangeInfo,
      secondExchangeInfo.params
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
      }
    );

    if (buyExchangeInProspect == -1) {
      return;
    }

    // === MAJOR TASK === 9 get the percentage and amounts lost due to slippage
    let slippageInfo;
    if (buyExchangeInProspect.type == firstExchangeInfo.type) {
      slippageInfo = slippageAmountCalculator(
        maximumAmountOutForFirstEx,
        maximumAmountOutForFirstExTraded
      );
    } else {
      slippageInfo = slippageAmountCalculator(
        maximumAmountOutForSecondEx,
        maximumAmountOutForSecondExTraded
      );
    }

    // === MAJOR TASK === 10 compare the amounts out from 8 plus slippage, check if amount is greater than initial investment plus fee goto log 2 else go to log 4
    if( buyExchangeInProspect.amountsOut > tradeAmount + fee){
      console.log("exchange is profitable with slippage applied")
      buyExchange = buyExchangeInProspect.type
    }else {
      console.log("exchange is not profitable with slippage applied")
      return
    }
    

    // === MAJOR TASK === 11 compare the amounts out from 8 minus slippage, check if amount is greater than initial investment plus fee goto log 3 else got to log 5
    if( buyExchangeInProspect.amountsOut + (await slippageInfo).slipAmount > tradeAmount + fee){
      console.log("exchange is profitable with slippage removed")
      buyExchange = buyExchangeInProspect.type
    }else{
      console.log("exchange is not profitable with slippage removed")
      return
    }
    // === MAJOR TASK === 12 if 10 is profitable return that exchange as the buy exchange and second exchange as the sell exchange
    return buyExchange
  }

  module.exports = {
    checkProfitableBuyExchange
  }