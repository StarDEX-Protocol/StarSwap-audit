import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { getPermitSignature } from '../utils/testHelpers/permit';
import { MAX_UINT256 } from '../utils/constants';
import { expect } from 'chai';

describe('Orders with permit', () => {
  it('Should allow to create a public order with permit', async () => {
    const { starSwap, starSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1] = await ethers.getSigners();

    const deadline = MAX_UINT256;
    const { v, r, s } = await getPermitSignature(
      user1,
      erc20Token,
      await starSwap.getAddress(),
      ethers.parseEther('1'),
      deadline,
    );

    await starSwap.createPublicOrderWithPermit(
      {
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
      },
      deadline,
      v,
      r,
      s,
    );

    const tokenId = await starSwapOrderManager.tokenOfOwnerByIndex(user1.getAddress(), 0);
    const order = await starSwapOrderManager.getOrder(tokenId);
    expect(await starSwapOrderManager.balanceOf(user1.getAddress())).to.equal(1);
    expect(order.makerSellToken).to.equal(await erc20Token.getAddress());
    expect(order.makerSellTokenAmount).to.equal(ethers.parseEther('1'));
    expect(order.makerBuyToken).to.equal(await wmaticToken.getAddress());
    expect(order.makerBuyTokenAmount).to.equal(ethers.parseEther('1'));
    expect(order.deadline).to.equal(0);
  });

  it('Should allow to fill a particular public order with permit', async () => {
    const { starSwap, starSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());

    await wmaticToken.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellToken: wmaticToken.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: erc20Token.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });

    const deadline = MAX_UINT256;
    const { v, r, s } = await getPermitSignature(
      user2,
      erc20Token,
      await starSwap.getAddress(),
      ethers.parseEther('1'),
    );

    await starSwap
      .connect(user2)
      .fillPublicOrderWithPermit(0, user2.getAddress(), deadline, v, r, s);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.0024'); // 1 * 0.24%

    expect(await starSwapOrderManager.totalSupply()).to.equal(0);

    expect(erc20User1BalanceBefore + ethers.parseEther('1')).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(erc20User2BalanceBefore - ethers.parseEther('1')).to.be.equal(
      erc20User2BalanceAfter,
    );
    expect(wethUser1BalanceBefore - ethers.parseEther('1')).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore + ethers.parseEther('1') - FEE).to.be.equal(
      wethUser2BalanceAfter,
    );
    expect(await wmaticToken.balanceOf(starSwap.getAddress())).to.equal(FEE);
  });

  it('Should allow to fill by market with permit', async () => {
    const { starSwap, wmaticToken, usdcToken, starSwapBatchExecutor } =
      await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const wmaticUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wmaticUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());
    const usdcUser1BalanceBefore = await usdcToken.balanceOf(user1.getAddress());
    const usdcUser2BalanceBefore = await usdcToken.balanceOf(user2.getAddress());

    await wmaticToken.approve(starSwap.getAddress(), ethers.parseEther('3'));
    await starSwap.createPublicOrder({
      makerSellToken: wmaticToken.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('1', 6),
      deadline: 0,
    });
    await starSwap.createPublicOrder({
      makerSellToken: wmaticToken.getAddress(),
      makerSellTokenAmount: ethers.parseEther('2'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('2', 6),
      deadline: 0,
    });

    const deadline = MAX_UINT256;
    const { v, r, s } = await getPermitSignature(
      user2,
      usdcToken,
      await starSwapBatchExecutor.getAddress(),
      ethers.parseUnits('2', 6),
    );

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrdersWithEntryPermit(
      [
        {
          orderId: 0,
          amountIn: ethers.parseUnits('1', 6),
        },
        {
          orderId: 1,
          amountIn: ethers.parseUnits('1', 6),
        },
      ],
      ethers.parseUnits('2', 6),
      deadline,
      v,
      r,
      s,
    );

    const wmaticUser1BalanceAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wmaticUser2BalanceAfter = await wmaticToken.balanceOf(user2.getAddress());
    const usdcUser1BalanceAfter = await usdcToken.balanceOf(user1.getAddress());
    const usdcUser2BalanceAfter = await usdcToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.0048'); // 2 * 0.24%

    expect(usdcUser1BalanceAfter).to.be.equal(
      usdcUser1BalanceBefore + ethers.parseUnits('2', 6),
    );
    expect(usdcUser2BalanceAfter).to.be.equal(
      usdcUser2BalanceBefore - ethers.parseUnits('2', 6),
    );
    expect(wmaticUser1BalanceAfter).to.be.equal(
      wmaticUser1BalanceBefore - ethers.parseEther('3'),
    );
    expect(wmaticUser2BalanceAfter).to.be.equal(
      wmaticUser2BalanceBefore + ethers.parseEther('2') - FEE,
    );
  });

  it('Fill partially a single order with permit', async () => {
    const { starSwap, starSwapOrderManager, erc20Token, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await wmaticToken.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellToken: wmaticToken.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: erc20Token.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });

    const deadline = MAX_UINT256;
    const { v, r, s } = await getPermitSignature(
      user2,
      erc20Token,
      await starSwap.getAddress(),
      ethers.parseEther('0.5'),
    );

    await starSwap.connect(user2).fillPublicOrderPartiallyWithPermit(
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
      user2.getAddress(),
      deadline,
      v,
      r,
      s,
    );

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await starSwapOrderManager.getOrder(0);
    expect(order.makerSellTokenAmount).to.be.equal(ethers.parseEther('0.5'));
    expect(order.makerBuyTokenAmount).to.be.equal(ethers.parseEther('0.5'));
  });
});
