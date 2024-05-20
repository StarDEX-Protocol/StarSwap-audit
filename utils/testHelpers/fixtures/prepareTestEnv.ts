import { deployStarSwap } from './deployStarSwap';
import { deployPlugins } from './deployPlugins';
import { distributeTokens } from './distributeTokens';

export const prepareTestEnv = async () => {
  const { starSwap, starSwapOrderManager, starSwapBatchExecutor, privateOrderExecutor } =
    await deployStarSwap();
  const { erc20Token, usdcToken, wmaticToken } = await distributeTokens();
  const { feeAggregatorPlugin, tokenWhitelistPlugin } = await deployPlugins(starSwap);

  await Promise.all([
    tokenWhitelistPlugin.addTokenToWhitelist(erc20Token.getAddress()),
    tokenWhitelistPlugin.addTokenToWhitelist(usdcToken.getAddress()),
    tokenWhitelistPlugin.addTokenToWhitelist(wmaticToken.getAddress()),
  ]);

  return {
    starSwap,
    starSwapOrderManager,
    starSwapBatchExecutor,
    privateOrderExecutor,
    tokenWhitelistPlugin,
    feeAggregatorPlugin,
    erc20Token,
    usdcToken,
    wmaticToken,
  };
};
