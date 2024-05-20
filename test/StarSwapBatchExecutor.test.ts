import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('BatchExecutor', () => {
  it('Should allow to fill by market with exact amount of input tokens', async () => {
    const {
      starSwap,
      starSwapOrderManager,
      starSwapBatchExecutor,
      erc20Token,
      wmaticToken,
    } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.getAddress());

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('3'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('2'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseEther('1.5'));

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('1'),
      },
      {
        orderId: 1,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.003'); // 1 * 0.24%
    expect(erc20User1BalanceBefore - ethers.parseEther('3')).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(erc20User2BalanceBefore + ethers.parseEther('1.25') - FEE).to.be.equal(
      erc20User2BalanceAfter,
    );
    expect(wethUser1BalanceBefore + ethers.parseEther('1.5')).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore - ethers.parseEther('1.5')).to.be.equal(
      wethUser2BalanceAfter,
    );

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await starSwapOrderManager.getOrder(1);
    expect(remainingOrder.makerSellTokenAmount).to.be.equal(ethers.parseEther('1.75'));
    expect(remainingOrder.makerBuyTokenAmount).to.be.equal(ethers.parseEther('3.5'));
  });

  it('Should allow to fill by market when tokens have different decimals', async () => {
    const {
      starSwap,
      starSwapOrderManager,
      starSwapBatchExecutor,
      erc20Token,
      usdcToken,
    } = await loadFixture(prepareTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.getAddress());
    const usdcUser1BalanceBefore = await usdcToken.balanceOf(user1.getAddress());
    const usdcUser2BalanceBefore = await usdcToken.balanceOf(user2.getAddress());

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('3'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6),
      deadline: 0,
    });
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('2'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('400', 6),
      deadline: 0,
    });

    await usdcToken
      .connect(user2)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseUnits('150', 6));

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseUnits('100', 6),
      },
      {
        orderId: 1,
        amountIn: ethers.parseUnits('50', 6),
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.getAddress());
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.getAddress());
    const usdcUser1BalanceAfter = await usdcToken.balanceOf(user1.getAddress());
    const usdcUser2BalanceAfter = await usdcToken.balanceOf(user2.getAddress());

    const FEE = ethers.parseEther('0.003'); // 1.25 * 0.24%

    expect(erc20User1BalanceAfter).to.be.equal(
      erc20User1BalanceBefore - ethers.parseEther('3'),
    );
    expect(erc20User2BalanceAfter).to.be.equal(
      erc20User2BalanceBefore + ethers.parseEther('1.25') - FEE,
    );
    expect(usdcUser1BalanceAfter).to.be.equal(
      usdcUser1BalanceBefore + ethers.parseUnits('150', 6),
    );
    expect(usdcUser2BalanceAfter).to.be.equal(
      usdcUser2BalanceBefore - ethers.parseUnits('150', 6),
    );

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await starSwapOrderManager.getOrder(1);
    expect(remainingOrder.makerSellTokenAmount).to.be.equal(ethers.parseEther('1.75'));
    expect(remainingOrder.makerBuyTokenAmount).to.be.equal(ethers.parseUnits('350', 6));
  });

  it('Fill partially a single order', async () => {
    const {
      starSwap,
      starSwapOrderManager,
      starSwapBatchExecutor,
      erc20Token,
      wmaticToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

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
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseEther('1'));

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await starSwapOrderManager.getOrder(0);
    expect(order.makerSellTokenAmount).to.be.equal(ethers.parseEther('0.5'));
    expect(order.makerBuyTokenAmount).to.be.equal(ethers.parseEther('0.5'));
  });

  it('Fill partially a single order when tokens have different decimals', async () => {
    const {
      starSwap,
      starSwapOrderManager,
      starSwapBatchExecutor,
      erc20Token,
      usdcToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6),
      deadline: 0,
    });

    await usdcToken
      .connect(user2)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseUnits('100', 6));

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseUnits('50', 6),
      },
    ]);

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await starSwapOrderManager.getOrder(0);
    expect(order.makerSellTokenAmount).to.be.equal(ethers.parseEther('0.5'));
    expect(order.makerBuyTokenAmount).to.be.equal(ethers.parseUnits('50', 6));
  });

  it('Fill partially a single order when tokens have different decimals and base asset has 6 decimals', async () => {
    const {
      starSwap,
      starSwapOrderManager,
      starSwapBatchExecutor,
      erc20Token,
      usdcToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await usdcToken.approve(starSwap.getAddress(), ethers.parseUnits('200', 6));
    await starSwap.createPublicOrder({
      makerSellToken: usdcToken.getAddress(),
      makerSellTokenAmount: ethers.parseUnits('200', 6),
      makerBuyToken: erc20Token.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });

    await erc20Token
      .connect(user2)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseEther('0.5'));

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await starSwapOrderManager.getOrder(0);
    expect(order.makerSellTokenAmount).to.be.equal(ethers.parseUnits('100', 6));
    expect(order.makerBuyTokenAmount).to.be.equal(ethers.parseEther('0.5'));
    expect(await usdcToken.balanceOf(starSwap.getAddress())).to.be.equal(
      ethers.parseUnits('100.24', 6), //remaining 100 USDC is still on the contract balance
    );
  });

  it('Fill single order with not even amounts (tests precision)', async () => {
    const {
      starSwap,
      starSwapOrderManager,
      starSwapBatchExecutor,
      erc20Token,
      wmaticToken,
    } = await loadFixture(prepareTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1.25'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1.25'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1.4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseEther('0.5'));

    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('0.5'),
      },
    ]);

    expect(await starSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await starSwapOrderManager.getOrder(0);
    expect(order.makerSellTokenAmount).to.be.equal(
      ethers.parseEther('0.803571428571428571'),
    );
    expect(order.makerBuyTokenAmount).to.be.equal(ethers.parseEther('0.9'));
  });

  it('should not allow to create an order when the maker sell token and maker buy token are the same', async () => {
    const { starSwap, erc20Token } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await expect(
      starSwap.createPublicOrder({
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: erc20Token.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(starSwap, 'StarSwap__InvalidPath');
  });

  it('should not allow to create an order when maker sell token or maker buy token amount is zero', async () => {
    const { starSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await expect(
      starSwap.createPublicOrder({
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: 0,
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: ethers.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(starSwap, 'StarSwap__MakerSellTokenAmountIsZero');
    await expect(
      starSwap.createPublicOrder({
        makerSellToken: erc20Token.getAddress(),
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticToken.getAddress(),
        makerBuyTokenAmount: 0,
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(starSwap, 'StarSwap__MakerBuyTokenAmountIsZero');
  });

  it('should allow to transfer ownership of the public order to another address', async () => {
    const {
      starSwap,
      erc20Token,
      wmaticToken,
      starSwapOrderManager,
      starSwapBatchExecutor,
    } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: wmaticToken.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('1'),
      deadline: 0,
    });

    const [user1, user2] = await ethers.getSigners();
    await starSwapOrderManager.transferFrom(user1.getAddress(), user2.getAddress(), 0);
    expect(await starSwapOrderManager.ownerOf(0)).to.be.equal(await user2.getAddress());

    const wmaticBalanceOfFirstUserBefore = await wmaticToken.balanceOf(
      user1.getAddress(),
    );
    const wmaticBalanceOfSecondUserBefore = await wmaticToken.balanceOf(
      user2.getAddress(),
    );

    await wmaticToken
      .connect(user2)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseEther('1'));
    await starSwapBatchExecutor.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.parseEther('1'),
      },
    ]);

    const wmaticBalanceOfFirstUserAfter = await wmaticToken.balanceOf(user1.getAddress());
    const wmaticBalanceOfSecondUserAfter = await wmaticToken.balanceOf(
      user2.getAddress(),
    );

    expect(wmaticBalanceOfFirstUserAfter).to.be.equal(wmaticBalanceOfFirstUserBefore);
    // should be the same as second user is now the owner of the order
    expect(wmaticBalanceOfSecondUserAfter).to.be.equal(wmaticBalanceOfSecondUserBefore);
  });

  it('should allow to batch fill orders in sequence', async () => {
    const { starSwap, starSwapBatchExecutor, erc20Token, usdcToken } =
      await loadFixture(prepareTestEnv);
    const [maker, taker] = await ethers.getSigners();

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await usdcToken.approve(starSwap.getAddress(), ethers.parseUnits('400', 6));
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6),
      deadline: 0,
    });
    await starSwap.createPublicOrder({
      makerSellToken: usdcToken.getAddress(),
      makerSellTokenAmount: ethers.parseUnits('400', 6),
      makerBuyToken: erc20Token.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('2'),
      deadline: 0,
    });

    const erc20MakerBalanceBefore = await erc20Token.balanceOf(maker.getAddress());
    const erc20TakerBalanceBefore = await erc20Token.balanceOf(taker.getAddress());
    const usdcMakerBalanceBefore = await usdcToken.balanceOf(maker.getAddress());
    const usdcTakerBalanceBefore = await usdcToken.balanceOf(taker.getAddress());

    await usdcToken
      .connect(taker)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseUnits('100', 6));

    await starSwapBatchExecutor.connect(taker).batchFillPublicOrdersInSequence([
      {
        orderId: 0,
        amountIn: ethers.parseUnits('100', 6),
      },
      {
        orderId: 1,
        // 100 usdc input should give 1 erc20 token output but we apply 0.24% fee
        amountIn: ethers.parseEther('0.9976'),
      },
    ]);

    await starSwap.cancelOrder(1n);

    const erc20MakerBalanceAfter = await erc20Token.balanceOf(maker.getAddress());
    const erc20TakerBalanceAfter = await erc20Token.balanceOf(taker.getAddress());
    const usdcMakerBalanceAfter = await usdcToken.balanceOf(maker.getAddress());
    const usdcTakerBalanceAfter = await usdcToken.balanceOf(taker.getAddress());
    const erc20StarswapBalanceAfter = await erc20Token.balanceOf(starSwap.getAddress());
    const usdcStarswapBalanceAfter = await usdcToken.balanceOf(starSwap.getAddress());
    const makerERC20Diff = erc20MakerBalanceAfter - erc20MakerBalanceBefore;
    const takerERC20Diff = erc20TakerBalanceAfter - erc20TakerBalanceBefore;
    const makerUSDCDiff = usdcMakerBalanceAfter - usdcMakerBalanceBefore;
    const takerUSDCDiff = usdcTakerBalanceAfter - usdcTakerBalanceBefore;

    expect(makerERC20Diff).to.be.equal(ethers.parseEther('0.9976'));
    expect(makerUSDCDiff).to.be.greaterThan(ethers.parseUnits('300', 6));

    // taker should not receive any erc20 tokens as it is only an intermediary transactions
    expect(takerERC20Diff).to.be.equal(0);
    expect(takerUSDCDiff).to.be.equal(ethers.parseUnits('99.041152', 6));

    // collected fees
    expect(erc20StarswapBalanceAfter).to.be.equal(ethers.parseEther('0.0024'));
    expect(usdcStarswapBalanceAfter).to.be.equal(ethers.parseUnits('0.478848', 6)); // 0.24% of around 200 usdc
  });






  it('Should send back all bought tokens', async () => {
    const { starSwap, starSwapBatchExecutor, erc20Token, usdcToken, wmaticToken } =
      await loadFixture(prepareTestEnv);
    const [maker, taker] = await ethers.getSigners();

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('1'));
    await wmaticToken.approve(starSwap.getAddress(), ethers.parseEther('4'));

    // give: 1 ERC20, want: 100 USDC
    await starSwap.createPublicOrder({
      makerSellToken: erc20Token.getAddress(),
      makerSellTokenAmount: ethers.parseEther('1'),
      makerBuyToken: usdcToken.getAddress(),
      makerBuyTokenAmount: ethers.parseUnits('100', 6),
      deadline: 0,
    });

    // give: 4 WETH, want: 1 ERC20
    await starSwap.createPublicOrder({
      makerSellToken: wmaticToken.getAddress(),
      makerSellTokenAmount: ethers.parseEther('4'),
      makerBuyToken: erc20Token.getAddress(),
      makerBuyTokenAmount: ethers.parseEther('0.5'),
      deadline: 0,
    });

    const erc20MakerBalanceBefore = await erc20Token.balanceOf(maker.getAddress());
    const erc20TakerBalanceBefore = await erc20Token.balanceOf(taker.getAddress());
    
    const usdcMakerBalanceBefore = await usdcToken.balanceOf(maker.getAddress());
    const usdcTakerBalanceBefore = await usdcToken.balanceOf(taker.getAddress());

    const wmaticMakerBalanceBefore = await wmaticToken.balanceOf(maker.getAddress());
    const wmaticTakerBalanceBefore = await wmaticToken.balanceOf(taker.getAddress());
    
    const FEE_0_5_Ether = ethers.parseEther('0.0012');
    const FEE_4_Ether = ethers.parseEther('0.0096');

    await usdcToken
      .connect(taker)
      .approve(starSwapBatchExecutor.getAddress(), ethers.parseUnits('100', 6));

    await starSwapBatchExecutor.connect(taker).batchFillPublicOrdersInSequence([
      {
        orderId: 0,
        amountIn: ethers.parseUnits('100', 6),
      },
      {
        orderId: 1,
        // 100 usdc input should give 1 erc20 token output but we apply 0.24% fee
        amountIn: ethers.parseEther('0.5') - FEE_0_5_Ether,
      },
    ]);

    const erc20MakerBalanceAfter = await erc20Token.balanceOf(maker.getAddress());
    const erc20TakerBalanceAfter = await erc20Token.balanceOf(taker.getAddress());

    const usdcMakerBalanceAfter = await usdcToken.balanceOf(maker.getAddress());
    const usdcTakerBalanceAfter = await usdcToken.balanceOf(taker.getAddress());

    const wmaticMakerBalanceAfter = await wmaticToken.balanceOf(maker.getAddress());
    const wmaticTakerBalanceAfter = await wmaticToken.balanceOf(taker.getAddress());
    
    const erc20StarswapBalanceAfter = await erc20Token.balanceOf(starSwap.getAddress());
    const usdcStarswapBalanceAfter = await usdcToken.balanceOf(starSwap.getAddress());
    const wmaticStarswapBalanceAfter = await wmaticToken.balanceOf(starSwap.getAddress());
    
    const makerERC20Diff = erc20MakerBalanceAfter - erc20MakerBalanceBefore;
    const takerERC20Diff = erc20TakerBalanceAfter - erc20TakerBalanceBefore;

    const makerUSDCDiff = usdcMakerBalanceAfter - usdcMakerBalanceBefore;
    const takerUSDCDiff = usdcTakerBalanceAfter - usdcTakerBalanceBefore;

    const makerWMaticDiff = wmaticMakerBalanceAfter - wmaticMakerBalanceBefore;
    const takerWMaticDiff = wmaticTakerBalanceAfter - wmaticTakerBalanceBefore;

    expect(makerERC20Diff).to.be.equal(ethers.parseEther('0.5') - FEE_0_5_Ether, "makerERC20Diff");
    expect(makerUSDCDiff).to.be.equal(ethers.parseUnits('100', 6), "makerUSDCDiff");
    expect(makerWMaticDiff).to.be.equal(ethers.parseEther('0'), "makerWMaticDiff");

    expect(takerERC20Diff).to.be.equal(ethers.parseEther('0.5') - FEE_0_5_Ether, "takerERC20Diff");
    expect(takerUSDCDiff).to.be.equal(-ethers.parseUnits('100', 6), "takerUSDCDiff");
    expect(takerWMaticDiff).to.be.equal(ethers.parseEther('4') - FEE_4_Ether, "takerWMaticDiff");

    // collected fees
    expect(erc20StarswapBalanceAfter).to.be.equal(FEE_0_5_Ether+FEE_0_5_Ether, "erc20StarswapBalanceAfter");
    expect(usdcStarswapBalanceAfter).to.be.equal(ethers.parseEther('0'), "usdcStarswapBalanceAfter"); 
    expect(wmaticStarswapBalanceAfter).to.be.equal(FEE_4_Ether, "wmaticStarswapBalanceAfter"); 
  });








  

});
