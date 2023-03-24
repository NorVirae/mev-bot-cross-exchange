pragma solidity ^0.8.0;

interface IUniswapV2Router02 {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
}

contract FrontrunnerBot {
    IUniswapV2Router02 private router;
    address private constant WETH = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

    constructor(address _router) {
        router = IUniswapV2Router02(_router);
    }

    function frontrun(address[] calldata path, uint amountOutMin, uint deadline) external payable {
        uint[] memory amounts = router.getAmountsOut(msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "FrontrunnerBot: insufficient output amount");

        router.swapExactETHForTokens{value: msg.value}(amountOutMin, path, msg.sender, deadline);
    }
}