const networkConfig = {
  31337: {
    name: "localhost",
    wethToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    lendingPoolAddressesProvider: "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    linkEthPriceFeed: "0xDC530D9457755926550b59e8ECcdaE7624181557",
    linkToken: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    uniswapAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
  // Price Feed Address, values can be obtained at https://docs.chain.link/docs/reference-contracts
  // Default one is ETH/USD contract on Kovan
  42: {
    name: "kovan",
    ethUsdPriceFeed: "0x9326BFA02ADD2366b30bacB125260Af641031331",
    wethToken: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
    lendingPoolAddressesProvider: "0x88757f2f99175387aB4C6a4b3067c77A695b0349",
    linkEthPriceFeed: "0xDC530D9457755926550b59e8ECcdaE7624181557",
    linkToken: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    uniswapAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
  networkConfig,
  developmentChains,
};
