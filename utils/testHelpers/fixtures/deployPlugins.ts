import { ethers } from 'hardhat';
import { StarSwap } from '../../../typechain-types';
import { DEFAULT_FEE } from '../../constants';

export async function deployPlugins(starSwap: StarSwap) {
  const FeeAggregatorPluginFactory =
    await ethers.getContractFactory('FeeAggregatorPlugin');
  const feeAggregatorPlugin = await FeeAggregatorPluginFactory.deploy(DEFAULT_FEE);

  const TokenWhitelistPluginFactory =
    await ethers.getContractFactory('TokenWhitelistPlugin');
  const tokenWhitelistPlugin = await TokenWhitelistPluginFactory.deploy();

  await starSwap.enablePlugin(feeAggregatorPlugin.getAddress(), '0x');
  await starSwap.enablePlugin(tokenWhitelistPlugin.getAddress(), '0x');

  return {
    feeAggregatorPlugin,
    tokenWhitelistPlugin,
  };
}
