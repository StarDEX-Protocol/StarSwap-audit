import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('PublicOrders', () => {
  it('Should deploy StarSwap and StarSwapOrderManager', async () => {
    const { starSwap, starSwapOrderManager } = await loadFixture(prepareTestEnv);

    expect(await starSwap.getAddress()).to.be.properAddress;
    expect(await starSwapOrderManager.getAddress()).to.be.properAddress;
  });

  it('Should allow to create a public order', async () => {
    const { starSwap, starSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1] = await ethers.getSigners();

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));

    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });

    const tokenId = await starSwapOrderManager.tokenOfOwnerByIndex(user1.getAddress(), 0);
    const order = await starSwapOrderManager.getOrder(tokenId);
    expect(await starSwapOrderManager.balanceOf(user1.getAddress())).to.equal(1);
    expect(order.makerSellToken).to.equal(await erc20Token.getAddress());
    expect(order.makerSellTokenAmount).to.equal(ethers.parseEther('1'));
    expect(order.makerBuyToken).to.equal(await wmaticToken.getAddress());
    expect(order.makerBuyTokenAmount).to.equal(ethers.parseEther('1'));
    expect(order.deadline).to.equal(0);
  });
  it('Should allow to cancel a public order with withdrawal of the maker sell tokens', async () => {
    const { starSwap, starSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1] = await ethers.getSigners();

    const balanceBeforeOrderCreation = await erc20Token.balanceOf(user1.getAddress());

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });
    const balanceAfterOrderCreation = await erc20Token.balanceOf(user1.getAddress());

    await starSwap.cancelOrder(0);
    const balanceAfterOrderCancellation = await erc20Token.balanceOf(user1.getAddress());
    expect(await starSwapOrderManager.balanceOf(await user1.getAddress())).to.equal(0);
    expect(balanceBeforeOrderCreation).to.equal(balanceAfterOrderCancellation);
    expect(balanceAfterOrderCreation).to.be.lessThan(balanceAfterOrderCancellation);
  });

  it('Should allow to fill a particular public order', async () => {
    const { starSwap, starSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.connect(user2).fillPublicOrder(0, user2.getAddress());

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.0024'); // 1 * 0.24%

    expect(await starSwapOrderManager.totalSupply()).to.equal(0);
    expect(erc20User1BalanceBefore - ethers.parseEther('1')).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(erc20User2BalanceBefore + ethers.parseEther('1') - FEE).to.be.equal(
      erc20User2BalanceAfter,
    );
    expect(wethUser1BalanceBefore + ethers.parseEther('1')).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore - ethers.parseEther('1')).to.be.equal(
      wethUser2BalanceAfter,
    );
    expect(await erc20Token.balanceOf(starSwap.getAddress())).to.equal(FEE);
  });
});
