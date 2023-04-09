
const executeTrade = async (tradeReport, crossFlashContract, params) => {
  if (tradeReport.profitable) {
    await crossFlashContract.initFlashUniswap(params);
  } else {
    console.log("couldn't execute trade is not profitable!");
  }
};

module.exports = {
    executeTrade
}