import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { createTradeRoute, sortOrdersByPrice } from '../router';
import { expect } from 'chai';

describe('Router', () => {
  describe('sortByPrice helper', () => {
    it('Should sort orders by price from the lowest to highest', () => {
      const orders = [
        {
          id: 0n,
          makerSellToken: '1',
          makerBuyToken: '2',
          makerSellTokenAmount: ethers.parseEther('3'),
          makerBuyTokenAmount: ethers.parseEther('15'),
          deadline: 0n,
        },
        {
          id: 1n,
          makerSellToken: '1',
          makerBuyToken: '2',
          makerSellTokenAmount: ethers.parseEther('2'),
          makerBuyTokenAmount: ethers.parseEther('2'),
          deadline: 0n,
        },
      ];
      const sortedByPrice = [...orders].sort(sortOrdersByPrice);
      expect(sortedByPrice[0]).to.be.equal(orders[1]);
      expect(sortedByPrice[1]).to.be.equal(orders[0]);
    });
  });

  it('router should return an empty path when there are no orders for given pair', async () => {
    const { erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    const path = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('2'),
      },
      [],
    );

    expect(path.map((step) => step.orderId)).to.be.deep.equal([]);
  });

  it('router should route through the best path when exact input is specified', async () => {
    const { starSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('3'));
    const [erc20TokenAddress, wmaticTokenAddress] = await Promise.all([
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    ]);
    const orders = [
      {
        id: 0n,
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('4'),
        deadline: 0n,
      },
      {
        id: 1n,
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('5'),
        deadline: 0n,
      },
      {
        id: 2n,
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('2'),
        deadline: 0n,
      },
    ];
    await starSwap.createPublicOrder(orders[0]);
    await starSwap.createPublicOrder(orders[1]);
    await starSwap.createPublicOrder(orders[2]);

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        sourceAmount: ethers.parseEther('2'),
      },
      orders,
    );
    expect(pathSingle.map((step) => step.orderId)).to.be.deep.equal([2]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        sourceAmount: ethers.parseEther('6'),
      },
      orders,
    );
    expect(pathTwo.map((step) => step.orderId)).to.be.deep.equal([2, 0]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        sourceAmount: ethers.parseEther('7'),
      },
      orders,
    );

    expect(pathTriple.map((step) => step.orderId)).to.be.deep.equal([2, 0, 1]);
  });

  it('getBestTradePathForExactOutput router function should route through the best path', async () => {
    const { starSwap, erc20Token, wmaticToken } = await loadFixture(prepareTestEnv);

    await erc20Token.approve(starSwap.getAddress(), ethers.parseEther('3'));
    const [erc20TokenAddress, wmaticTokenAddress] = await Promise.all([
      erc20Token.getAddress(),
      wmaticToken.getAddress(),
    ]);
    const orders = [
      {
        id: 0n,
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('4'),
        deadline: 0n,
      },
      {
        id: 1n,
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('5'),
        deadline: 0n,
      },
      {
        id: 2n,
        makerSellToken: erc20TokenAddress,
        makerSellTokenAmount: ethers.parseEther('1'),
        makerBuyToken: wmaticTokenAddress,
        makerBuyTokenAmount: ethers.parseEther('2'),
        deadline: 0n,
      },
    ];
    await starSwap.createPublicOrder(orders[0]);
    await starSwap.createPublicOrder(orders[1]);
    await starSwap.createPublicOrder(orders[2]);

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        destinationAmount: ethers.parseEther('1'),
      },
      orders,
    );
    expect(pathSingle.map((step) => step.orderId)).to.be.deep.equal([2]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20TokenAddress,
        sourceToken: wmaticTokenAddress,
        destinationAmount: ethers.parseEther('2'),
      },
      orders,
    );
    expect(pathTwo.map((step) => step.orderId)).to.be.deep.equal([2, 0]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: await erc20Token.getAddress(),
        sourceToken: await wmaticToken.getAddress(),
        destinationAmount: ethers.parseEther('3'),
      },
      orders,
    );
    expect(pathTriple.map((step) => step.orderId)).to.be.deep.equal([2, 0, 1]);
  });
});
