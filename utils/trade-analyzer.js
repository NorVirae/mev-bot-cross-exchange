const {
  exchangeSelectorForSingularPriceOutput,
  getMostProfitableExchangeByComparison,
  fetchReverseSellResult,
} = require("./trade-utils");

async function simulateTradeWithSlippage(
  firstExchangeInfo,
  secondExchangeInfo
) {
  let tradeReport = {
    buyExchange: "",
    sellExchange: "",
    isProfitable: false,
    tradeAmount: 0,
    toAmountAfterBuy: 0,
    fromAmountAfterSell: 0,
  };
  let smallAmountOutForOneQuantityFirstEx = 0;
  let smallAmountOutForOneQuantitySecondEx = 0;

  let maximumAmountOutForFirstEx = 0;
  let maximumAmountOutForSecondEx = 0;

  let buyExchange;
  let sellExchange;

  // get unit price for input amount to output amount for first Exchange
  smallAmountOutForOneQuantityFirstEx =
    await exchangeSelectorForSingularPriceOutput(firstExchangeInfo);

  // get unit price for input amount to output amount for second Exchange
  smallAmountOutForOneQuantitySecondEx =
    await exchangeSelectorForSingularPriceOutput(secondExchangeInfo);

  // determine amount out from real trade input amount for first Exchange
  maximumAmountOutForFirstEx =
    smallAmountOutForOneQuantityFirstEx * tradeAmount;

  // determine amount out from real trade input amount for second Exchange
  maximumAmountOutForSecondEx =
    smallAmountOutForOneQuantitySecondEx * tradeAmount;

  // check which exchange has got the highest price for amount out
  // Note: let cheapest exchange be buy exchange and the other sell exchange
  // set Buy exchange

  buyExchange = await getMostProfitableExchangeByComparison(
    {
      exchangeType: firstExchangeInfo.type,
      amount: maximumAmountOutForFirstEx,
    },
    {
      exchangeType: secondExchangeInfo.type,
      amount: maximumAmountOutForSecondEx,
    }
  );

  sellExchange =
    buyExchange === firstExchangeInfo.type
      ? firstExchangeInfo.type
      : secondExchangeInfo.type;

  // check profitability by determining reverse amount from sell exchange rate
  let returnAmountInfo = { amountOut: 0, exchangeType: "" };
  returnAmountInfo = fetchReverseSellResult(
    buyExchange,
    firstExchangeInfo,
    maximumAmountOutForFirstEx,
    smallAmountOutForOneQuantityFirstEx,
    maximumAmountOutForSecondEx,
    smallAmountOutForOneQuantitySecondEx
  );
  // is profitable if amount out is greater than trade amount + fee
  let isProfitable = Number(tradeAmount) + ((tradeAmount * 3) / 997 + 1);

  // return buy exchange, sell Exchange, profitability, tradeAmount, to Amount after Buy, from amount after sell
  return (tradeReport = {
    buyExchange,
    sellExchange,
    isProfitable: isProfitable,
    tradeAmount,
    toAmountAfterBuy:
      buyExchange === firstExchangeInfo.type
        ? maximumAmountOutForFirstEx
        : maximumAmountOutForSecondEx,
    fromAmountAfterSell:
      sellExchange === firstExchangeInfo.type
        ? maximumAmountOutForFirstEx
        : maximumAmountOutForSecondEx,
  });
}

async function simulateTradeWithoutSlippage() {
  // vars
  let buyExchange;
  let sellExchange;
  // get amounts out from first exchange function with respect to trade amount
  maximumAmountOutForFirstExTraded =
    await exchangeSelectorForConclusiveAmountsOut(firstExchangeInfo);
  // get amounts out from second exchange function with respect to trade amount
  maximumAmountOutForSecondExTraded =
    await exchangeSelectorForConclusiveAmountsOut(secondExchangeInfo);
  // check greater exchange set as buy exchange and lesser as sell exchange
  buyExchange =
    Number(maximumAmountOutForFirstExTraded) >
    Number(maximumAmountOutForSecondExTraded)
      ? firstExchangeInfo.type
      : secondExchangeInfo.type;

    sellExchange = buyExchange == firstExchangeInfo.type? secondExchangeInfo.type: firstExchangeInfo.type
  // now set amount out into sell exchange
  // check if amount out is greater than trade amount
  // is profitable if amount out is greater than trade amount + fee
  // return buy Exchange, sell exchange, profitability, trademount, to amount after buy, from amount after sell.
}
