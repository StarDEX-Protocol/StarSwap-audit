import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { expect } from 'chai';
import { hashOrder } from '../utils/testHelpers/hashOrder';
import { ethers } from 'hardhat';

describe('TokenWhitelistPlugin', () => {
  it('owner should be allowed to whitelist a token', async () => {
    const { tokenWhitelistPlugin } = await loadFixture(prepareTestEnv);

    await tokenWhitelistPlugin.addTokenToWhitelist(ethers.ZeroAddress);
    const whitelistedTokens = await tokenWhitelistPlugin.getWhitelistedTokens();
    expect(whitelistedTokens).to.include(ethers.ZeroAddress);
    expect(whitelistedTokens.length).to.be.equal(4);
  });

  it('owner should be allowed to remove a token from whitelist', async () => {
    const { tokenWhitelistPlugin, erc20Token } = await loadFixture(prepareTestEnv);

    await tokenWhitelistPlugin.removeTokenFromWhitelist(erc20Token.getAddress());
    const whitelistedTokens = await tokenWhitelistPlugin.getWhitelistedTokens();
    expect(whitelistedTokens).to.not.include(erc20Token.getAddress());
    expect(whitelistedTokens.length).to.be.equal(2);
  });

  it('should allow to get the list of whitelisted tokens', async () => {
    const { tokenWhitelistPlugin, erc20Token, wmaticToken, usdcToken } =
      await loadFixture(prepareTestEnv);

    const whitelistedTokens = await tokenWhitelistPlugin.getWhitelistedTokens();
    expect(whitelistedTokens).to.contain.members([
      await erc20Token.getAddress(),
      await wmaticToken.getAddress(),
      await usdcToken.getAddress(),
    ]);
  });

  it('should not allow to create a public order for a token that is not whitelisted', async () => {
    const { starSwap, tokenWhitelistPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);

    await tokenWhitelistPlugin.removeTokenFromWhitelist(erc20Token.getAddress());

    await expect(
      starSwap.createPublicOrder({
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(
      tokenWhitelistPlugin,
      'TokenWhitelistPlugin__TokenNotWhitelisted',
    );

    await expect(
      starSwap.createPublicOrder({
        makerSellToken: wmaticToken.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: erc20Token.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(
      tokenWhitelistPlugin,
      'TokenWhitelistPlugin__TokenNotWhitelisted',
    );
  });

  it('should not allow to fill a public order with tokens that are not whitelisted', async () => {
    const { starSwap, tokenWhitelistPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      makerSellToken: erc20Token.getAddress(),
      makerBuyToken: wmaticToken.getAddress(),
    });

    await tokenWhitelistPlugin.removeTokenFromWhitelist(erc20Token.getAddress());

    await expect(
      starSwap.connect(user2).fillPublicOrder(0, user2.getAddress()),
    ).to.be.revertedWithCustomError(
      tokenWhitelistPlugin,
      'TokenWhitelistPlugin__TokenNotWhitelisted',
    );
  });

  it('should not allow to fill a private order with tokens that are not on whitelist', async () => {
    const { privateOrderExecutor, tokenWhitelistPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await tokenWhitelistPlugin.removeTokenFromWhitelist(erc20Token.getAddress());

    await erc20Token.approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));
    const order = {
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      makerSellToken: await erc20Token.getAddress(),
      makerBuyToken: await wmaticToken.getAddress(),
      maker: await user1.getAddress(),
      recipient: await user2.getAddress(),
      creationTimestamp: Math.floor(Date.now() / 1000),
    };
    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.getBytes(orderHash));
    await wmaticToken
      .connect(user2)
      .approve(privateOrderExecutor.getAddress(), ethers.parseEther('1'));

    await expect(
      privateOrderExecutor.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(
      tokenWhitelistPlugin,
      'TokenWhitelistPlugin__TokenNotWhitelisted',
    );
  });

  it('should allow to cancel a public order even when tokens are no longer on the whitelist', async () => {
    const { starSwap, tokenWhitelistPlugin, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
      makerSellToken: erc20Token.getAddress(),
      makerBuyToken: wmaticToken.getAddress(),
    });

    await tokenWhitelistPlugin.removeTokenFromWhitelist(erc20Token.getAddress());

    await starSwap.cancelOrder(0);
  });
});
