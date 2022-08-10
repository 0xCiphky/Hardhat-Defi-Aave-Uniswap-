const { link } = require("ethereum-waffle");
const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("./getWeth");
const { networkConfig } = require("../helper-hardhat-config");

async function main() {
  //run our script to exchange our ETH to WETH
  console.log("Step 1: Exchange ETH into WETH");
  await getWeth();
  const { deployer } = await getNamedAccounts();
  //lending pool address provider
  const lendingPool = await getLendingPool(deployer);

  //console.log(`lendingPoolAddress ${lendingPool.address}`);

  console.log(
    "step2: Approve our WETH so we can deposit it into Aave protocol"
  );
  //lets deposit money into the aave protocol
  //TO do this we need to approve the aave contract as they use safetransfer
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);

  console.log("step3: Deposit funds into Aave protocol");
  //deposit into aave
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log(`${AMOUNT} Funds deposited!`);

  console.log("Account Details:");
  //Next let's check our account information
  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  );
  //console.log("total debt");
  //console.log(totalDebtETH.toString());

  console.log(
    "Step4: Let's get the latest WETH/LINK conversion rate using chainlink feeds"
  );
  //check conversion rate of eth to link
  const linkPrice = await getLinkPrice();
  console.log(`The WETH/LINK conversion rate is ${linkPrice.toString()}`);
  const amountLinkBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / linkPrice.toNumber());
  console.log(
    `If we borrow 95% of how much we are allowed to borrow, we will have ${amountLinkBorrow} Link`
  );
  const amountLinkBorowWEI = await ethers.utils.parseEther(
    amountLinkBorrow.toString()
  );
  //console.log(`The amount of link to borrow  is ${amountLinkBorrow}`);
  //console.log(`The amount of link to borrow in WEI is ${amountLinkBorowWEI}`);

  console.log("step5: Borrow 95% of the total amount we are allowed to borrow");
  //borrow link
  const linkTokenAddress = networkConfig[network.config.chainId].linkToken;
  await borrowLink(
    lendingPool,
    linkTokenAddress,
    amountLinkBorowWEI,
    deployer,
    linkPrice
  );

  //check our user data after we have borrowed
  console.log("Account Details:");
  ({ availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  ));

  console.log("step6: Approve and pay back the borrowed amount");

  //repay the link we borrowed, have to approve first
  await approveErc20(
    linkTokenAddress,
    lendingPool.address,
    amountLinkBorowWEI,
    deployer
  );
  await repayBorrowedAmount(
    lendingPool,
    linkTokenAddress,
    amountLinkBorowWEI,
    deployer,
    linkPrice
  );
  console.log(
    "We still have to pay back the interest that was accumulated, lets go to uniswap and exchange some WETH for link to pay this offf"
  );
  console.log("Account Details:");
  //lets see the user data one more time
  ({ availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  ));

  //we still have some interest to pay off
  //lets go to uniswap and get some link to pay it off
  console.log(
    "Step7: Approve and exchange some WETH for link in uniswap to pay back the interest"
  );
  await getWeth();
  await uniswapExchange(
    wethTokenAddress,
    linkTokenAddress,
    deployer,
    ethers.utils.parseEther("0.0000001"),
    1
  );

  console.log("Step8: Approve and deposit the link into Aave");
  await approveErc20(
    linkTokenAddress,
    lendingPool.address,
    ethers.utils.parseEther("0.0000001"),
    deployer
  );

  await lendingPool.deposit(
    linkTokenAddress,
    ethers.utils.parseEther("0.0000001"),
    deployer,
    0
  );
  console.log("Funds deposited!");

  console.log("Account Details:");
  await getBorrowUserData(lendingPool, deployer);

  const totalDebtLink = totalDebtETH / linkPrice;
  //console.log(
  //  `Interest left to be paid of in link is ${totalDebtLink.toString()}`
  //);

  ("step9: Approve and pay back the link interest we had in our account");
  await approveErc20(
    linkTokenAddress,
    lendingPool.address,
    ethers.utils.parseEther("0.0000001"),
    deployer
  );

  await repayBorrowedAmount(
    lendingPool,
    linkTokenAddress,
    ethers.utils.parseEther("0.0000001"),
    deployer,
    linkPrice
  );

  console.log("Account Details:");
  await getBorrowUserData(lendingPool, deployer);

  console.log("Interest paid off!");
}

// Function to exchange tokens from uniswap
async function uniswapExchange(
  wethTokenAddress,
  linkTokenAddress,
  account,
  amountIn,
  _amountOutMin
) {
  const uniswapAddress = networkConfig[network.config.chainId].uniswapAddress;
  const uniswapToken = await ethers.getContractAt(
    "IUniswapV2Router",
    uniswapAddress,
    account
  );
  await approveErc20(wethTokenAddress, uniswapAddress, amountIn, account);

  const path = [wethTokenAddress, linkTokenAddress];
  await uniswapToken.swapExactTokensForTokens(
    amountIn,
    _amountOutMin,
    path,
    account,
    Date.now() + 120 // 2mintues for transaction to go through
  );
  console.log(`Exchanged for link`);
}

//Function to borrow a certain amount of link from Aave
//NOTE: can be modified to any token by changing the linkAddress param
async function borrowLink(
  lendingPool,
  linkAddress,
  amount,
  account,
  _linkPrice
) {
  console.log("Borrowing...");
  const borrow = await lendingPool.borrow(linkAddress, amount, 1, 0, account);
  await borrow.wait(1);
  const amountInLink = amount / 1e18;
  console.log(`You have borrowed ${amountInLink} LINK`);
}

//Function to pay back the borrowed amount from Aave protocol
//NOTE: This does not include the interest fee, that will be done seperately
async function repayBorrowedAmount(
  lendingPool,
  linkAddress,
  amount,
  account,
  _linkPrice
) {
  const amountInLink = amount / _linkPrice;
  console.log(`Paying back ${amountInLink}`);
  const repay = await lendingPool.repay(linkAddress, amount, 1, account);
  await repay.wait(1);
  console.log(`We have repaid ${amountInLink} of Link`);
}

//Function to get the lending pool contract in order to connect and interact with the Aave protcol
async function getLendingPool(account) {
  const lendingPoolAddressProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    networkConfig[network.config.chainId].lendingPoolAddressesProvider,
    account
  );

  //function from the lendingpooladdressprovider to get the lending pool address
  const LendingPoolAddress = await lendingPoolAddressProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    LendingPoolAddress,
    account
  );
  return lendingPool;
}

//Function to get the latest price of a token (link in our case) from chainlink feeds
async function getLinkPrice() {
  // we are only reading from here so don't need a signer
  const LinkPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    networkConfig[network.config.chainId].linkEthPriceFeed
  );
  const { answer } = await LinkPriceFeed.latestRoundData();
  return answer;
}

//Function to approve a token before a transaction is made
async function approveErc20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    erc20Address,
    account
  );
  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log(`${amountToSpend} WETH has been Approved!`);
}

////Function that displays the users current account information on Aave protcol
async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);
  console.log("----------------------------------");
  console.log(`You have ${totalCollateralETH} worth of WETH deposited`);
  console.log(`You have ${totalDebtETH} worth of WETH borrowed.`);
  console.log(`You can borrow ${availableBorrowsETH} worth of WETH.`);
  console.log("----------------------------------");
  return { availableBorrowsETH, totalDebtETH };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
