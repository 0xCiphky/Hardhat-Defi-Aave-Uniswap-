const { ethers, getNamedAccounts, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");

const AMOUNT = ethers.utils.parseEther("0.02");

async function getWeth() {
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  // need the ABI and contract address
  const iWeth = await ethers.getContractAt(
    "IWeth",
    networkConfig[chainId].wethToken,
    deployer
  );

  //call the deposit function on the WETH contract
  const txResponse = await iWeth.deposit({
    value: AMOUNT,
  });
  await txResponse.wait(1);
  const wethBalance = await iWeth.balanceOf(deployer);
  const ethBal = wethBalance / 1e18;
  console.log(`Got ${wethBalance.toString()} WETH (${ethBal.toString()} ETH)`);
}

module.exports = { getWeth, AMOUNT };
