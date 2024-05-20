// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import './StarSwapOrderManager.sol';
import './OrderStructs.sol';

interface IStarSwapErrors {
  error StarSwap__InvalidOrderSignature();
  error StarSwap__InsufficientMakerBalance();
  error StarSwap__YouAreNotARecipient();
  error StarSwap__NotAnOwner();
  error StarSwap__OrderDoesNotExist();
  error StarSwap__OrderExpired();
  error StarSwap__OrderHaveAlreadyBeenExecuted();
  error StarSwap__MakerSellTokenAmountIsZero();
  error StarSwap__MakerBuyTokenAmountIsZero();
  error StarSwap__InsufficientAmountOut();
  error StarSwap__AmountInExceededLimit();
  error StarSwap__InvalidPath();
  error StarSwap__IncorrectOrderType();
  error StarSwap__WithdrawalViolatesFullBackingRequirement();
}

interface IStarSwapEvents {
  event PublicOrderCreated(
    uint256 indexed tokenId,
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address owner,
    uint256 deadline
  );
  event PublicOrderFilled(
    uint256 indexed tokenId,
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address owner,
    address taker
  );
  event PublicOrderPartiallyFilled(uint256 indexed tokenId, address indexed taker);
  event PublicOrderCancelled(
    uint256 indexed tokenId,
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address owner
  );
  event PrivateOrderInvalidated(
    address indexed makerSellToken,
    uint256 makerSellTokenAmount,
    address indexed makerBuyToken,
    uint256 makerBuyTokenAmount,
    address indexed maker,
    address recipient,
    uint256 deadline,
    uint256 creationTimestamp,
    bytes32 orderHash
  );
  event PrivateOrderFilled(
    address indexed makerSellToken,
    address indexed makerBuyToken,
    address maker,
    address taker
  );
  event PluginEnabled(address indexed plugin);
  event PluginDisabled(address indexed plugin);
}
