import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { expect } from 'chai';

describe('StarSwap plugin management', () => {
  it('allows to enable a plugin', async () => {
    const { starSwap } = await loadFixture(prepareTestEnv);
    const tokenWhitelistPluginFactory =
      await ethers.getContractFactory('TokenWhitelistPlugin');
    const tokenWhitelistPluginInstance = await tokenWhitelistPluginFactory.deploy();
    await expect(
      starSwap.enablePlugin(await tokenWhitelistPluginInstance.getAddress(), '0x'),
    ).to.emit(starSwap, 'PluginEnabled');
  });

  it('allows to disable a plugin', async () => {
    const { starSwap, feeAggregatorPlugin } = await loadFixture(prepareTestEnv);
    await starSwap.disablePlugin(await feeAggregatorPlugin.getAddress(), '0x');
  });

  it('does nothing when plugin is already enabled', async () => {
    const { starSwap, tokenWhitelistPlugin } = await loadFixture(prepareTestEnv);
    await expect(
      starSwap.enablePlugin(await tokenWhitelistPlugin.getAddress(), '0x'),
    ).not.to.emit(starSwap, 'PluginEnabled');
  });

  it('does nothing when plugin is already disabled', async () => {
    const { starSwap, tokenWhitelistPlugin } = await loadFixture(prepareTestEnv);
    await expect(
      starSwap.disablePlugin(await tokenWhitelistPlugin.getAddress(), '0x'),
    ).to.emit(starSwap, 'PluginDisabled');

    await expect(
      starSwap.disablePlugin(await tokenWhitelistPlugin.getAddress(), '0x'),
    ).to.not.emit(starSwap, 'PluginDisabled');
  });

  it('allows to get the list of enabled plugins', async () => {
    const { starSwap, tokenWhitelistPlugin, feeAggregatorPlugin } =
      await loadFixture(prepareTestEnv);
    expect(await starSwap.getPlugins()).to.contain.members([
      await tokenWhitelistPlugin.getAddress(),
      await feeAggregatorPlugin.getAddress(),
    ]);
  });
});
