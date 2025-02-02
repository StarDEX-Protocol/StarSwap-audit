// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/governance/TimelockController.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './IStarSwap.sol';
import './OrderStructs.sol';
import { IPlugin, PluginCallsConfig } from './plugins/IPlugin.sol';
import { StarSwapOrderManager } from './StarSwapOrderManager.sol';
import { PairLib } from './libraries/PairLib.sol';
import { OrderLib } from './libraries/OrderLib.sol';
import { PluginLib, PluginsToRun } from './libraries/PluginLib.sol';
import { OrderSignatureVerifierLib } from './libraries/OrderSignatureVerifierLib.sol';
import { TokenTreasuryLib, Treasury } from './libraries/TokenTreasuryLib.sol';
import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @notice StarSwap is a decentralized spot exchange designed for ERC-20 tokens compatible with EVM chains. 
 * It caters to projects that lack the funds to establish a sufficient liquidity pool for traditional DEX 
 * platforms like Uniswap. StarSwap enables these projects to offer their users a peer-to-peer token 
 * exchange in a permissionless manner, without intermediaries.
 */
contract StarSwap is IStarSwapEvents, IStarSwapErrors, AccessControl, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using TokenTreasuryLib for Treasury;
  using EnumerableSet for EnumerableSet.AddressSet;

  /// @dev manager for public orders (ERC721)
  StarSwapOrderManager public immutable orderManager;
  /// @dev list of plugins
  EnumerableSet.AddressSet private plugins;
  /// @dev computed plugin call configs stored in a more query-friendly way
  PluginsToRun private pluginCallConfigs;
  /// @dev treasury state that keeps track of all tokens needed for orders to be fully backed
  Treasury private tokenTreasury;

  /// @dev role that allows the entity to withdraw fees
  bytes32 public constant TREASURY_OWNER = keccak256('TREASURY_OWNER');

  constructor() {
    orderManager = new StarSwapOrderManager();
    _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _grantRole(TREASURY_OWNER, _msgSender());
  }

  // ======== PLUGIN FUNCTIONS ========

  /**
   * @return list of currently enabled plugins
   */
  function getPlugins() external view returns (address[] memory) {
    return plugins.values();
  }

  /**
   * @notice Allows to enable a plugin
   * @param plugin a plugin address to be enabled
   * @param initData additional init data. Bytes format is used so it can be abi decoded on the plugin side.
   */
  function enablePlugin( 
    IPlugin plugin,
    bytes memory initData
  ) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (!plugins.add(address(plugin))) return;

    PluginLib.storePluginCallConfig(pluginCallConfigs, plugin);
    plugin.enable(initData);
    emit PluginEnabled(address(plugin));
  }

  /**
   * @notice Allows to disable a plugin
   * @param plugin a plugin address to be disabled
   * @param data additional data for disable function. Bytes format is used so it can be abi decoded
   * on the plugin side.
   */
  function disablePlugin(
    IPlugin plugin,
    bytes memory data
  ) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (!plugins.remove(address(plugin))) return;

    PluginLib.removePluginCallConfig(pluginCallConfigs, plugin);
    plugin.disable(data);
    emit PluginDisabled(address(plugin));
  }

  // ======== TREASURY FUNCTIONS ========

  /**
   * Withdraws tokens from the contract. Treasury keeps track of all tokens needed for orders to be fully backed so
   * owner cannot drain the contract. Owner can only withdraw tokens that contract holds on top of what is needed
   * for the contract to be fully backed. Usefull for collecting fees and rescuing tokens that were sent to the
   * contract by mistake.
   * @param token token to withdraw
   * @param amount amount to withdraw
   */
  function withdraw(address token, uint256 amount) external onlyRole(TREASURY_OWNER) {
    uint256 tokensNeededForOrdersToBeFullyBacked = tokenTreasury.getBalance(token);
    uint256 tokensAvailibleToWithdraw = IERC20(token).balanceOf(address(this)) -
      tokensNeededForOrdersToBeFullyBacked;

    if (amount > tokensAvailibleToWithdraw) {
      revert StarSwap__WithdrawalViolatesFullBackingRequirement();
    }

    IERC20(token).safeTransfer(_msgSender(), amount);
  }

  // ======== PUBLIC ORDER FUNCTIONS ========

  /**
   * @notice Creates a public order with a permit signature so that the public order can be created
   * in a single transaction.
   * @param order public order data
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return orderId ID of the created order
   */
  function createPublicOrderWithPermit(
    PublicOrder calldata order,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 orderId) {
    IERC20Permit(order.makerSellToken).permit(
      _msgSender(),
      address(this),
      order.makerSellTokenAmount,
      deadline,
      v,
      r,
      s
    );
    return createPublicOrder(order);
  }

  /**
   * @notice Creates a public order. The token that maker sells must be approved for transfer to
   * the exchange. Only whitelisted tokens can be used.
   * @param order public order data
   * @return orderId ID of the created order
   */
  function createPublicOrder(
    PublicOrder memory order
  ) public nonReentrant returns (uint256 orderId) {
    if (order.makerSellTokenAmount == 0) revert StarSwap__MakerSellTokenAmountIsZero();
    if (order.makerBuyTokenAmount == 0) revert StarSwap__MakerBuyTokenAmountIsZero();
    if (order.makerBuyToken == order.makerSellToken) revert StarSwap__InvalidPath();

    order = PluginLib.runBeforeOrderCreation(pluginCallConfigs, order);

    orderId = orderManager.safeMint(_msgSender(), order);

    IERC20(order.makerSellToken).safeTransferFrom(
      _msgSender(),
      address(this),
      order.makerSellTokenAmount
    );
    tokenTreasury.add(order.makerSellToken, order.makerSellTokenAmount);

    emit PublicOrderCreated(
      orderId,
      order.makerSellToken,
      order.makerBuyToken,
      _msgSender(),
      order.deadline
    );

    order = PluginLib.runAfterOrderCreation(pluginCallConfigs, order);
  }

  /**
   * @notice Cancels a public order. Only the order owner can cancel it. The token that maker sells
   * is transferred back to the order owner.
   * @param orderId ID of the order to fill
   */
  function cancelOrder(uint256 orderId) external {
    PublicOrder memory order = orderManager.getOrder(orderId);
    address orderOwner = orderManager.ownerOf(orderId);
    if (orderOwner != _msgSender()) revert StarSwap__NotAnOwner();

    order = PluginLib.runBeforeOrderCancel(pluginCallConfigs, order);

    IERC20(order.makerSellToken).safeTransfer(_msgSender(), order.makerSellTokenAmount);
    tokenTreasury.subtract(order.makerSellToken, order.makerSellTokenAmount);

    emit PublicOrderCancelled(
      orderId,
      order.makerSellToken,
      order.makerBuyToken,
      orderOwner
    );

    orderManager.burn(orderId);

    order = PluginLib.runAfterOrderCancel(pluginCallConfigs, order);
  }

  /**
   * @notice Fills a public order with permit signature so that the public order can be filled in a
   * single transaction. Only whitelisted tokens can be used.
   * @param orderId Order ID to fill
   * @param tokenDestination a recipient of the output token
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return result swap result with data like the amount of output token received and amount of input token spent
   */
  function fillPublicOrderWithPermit(
    uint256 orderId,
    address tokenDestination,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderId);
    IERC20Permit(order.makerBuyToken).permit(
      _msgSender(),
      address(this),
      order.makerBuyTokenAmount,
      deadline,
      v,
      r,
      s
    );
    return _fillPublicOrder(orderId, order, tokenDestination);
  }

  /**
   * @notice Fills a public order. The maker buy token of the order must be approved for transfer
   * to the exchange. Only whitelisted tokens can be used.
   * @param orderId Order ID to fill
   * @param tokenDestination a recipient of the output token
   * @return result swap result with data like the amount of output token received and amount
   * of input token spent
   */
  function fillPublicOrder(
    uint256 orderId,
    address tokenDestination
  ) public returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderId);
    return _fillPublicOrder(orderId, order, tokenDestination);
  }

  function _fillPublicOrder(
    uint256 orderId,
    PublicOrder memory order,
    address tokenDestination
  ) internal nonReentrant returns (SwapResult memory result) {
    if (order.makerBuyToken == address(0) && order.makerSellToken == address(0)) {
      revert StarSwap__OrderDoesNotExist();
    }
    if (order.deadline != 0 && block.timestamp > order.deadline)
      revert StarSwap__OrderExpired();

    address orderOwner = orderManager.ownerOf(orderId);

    tokenTreasury.subtract(order.makerSellToken, order.makerSellTokenAmount);

    order = PluginLib.runBeforeOrderFill(pluginCallConfigs, order);

    result = SwapResult({
      outputToken: order.makerSellToken,
      outputAmount: order.makerSellTokenAmount,
      inputToken: order.makerBuyToken,
      inputAmount: order.makerBuyTokenAmount
    });

    // transfer tokens on behalf of the order filler to the order owner
    IERC20(order.makerBuyToken).safeTransferFrom(
      _msgSender(),
      orderOwner,
      order.makerBuyTokenAmount
    );

    // Transfer tokens to the taker on behalf of the order owner that were
    // deposited to this contract when the order was created.
    IERC20(order.makerSellToken).safeTransfer(
      tokenDestination,
      order.makerSellTokenAmount
    );

    orderManager.burn(orderId);

    emit PublicOrderFilled(
      orderId,
      order.makerSellToken,
      order.makerBuyToken,
      orderOwner,
      _msgSender()
    );

    order = PluginLib.runAfterOrderFill(pluginCallConfigs, order);
  }

  /**
   * @notice Fills a public order partially with permit signature so that the public order can be filled in a
   * single transaction. Only whitelisted tokens can be used.
   * @param orderFillRequest Order fill request data
   * @param tokenDestination a recipient of the output token
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return result swap result with data like the amount of output token received and amount of input token spent
   */
  function fillPublicOrderPartiallyWithPermit(
    OrderFillRequest memory orderFillRequest,
    address tokenDestination,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderFillRequest.orderId);
    uint256 amountToApprove = orderFillRequest.amountIn;
    IERC20Permit(order.makerBuyToken).permit(
      _msgSender(),
      address(this),
      amountToApprove,
      deadline,
      v,
      r,
      s
    );
    return _fillPublicOrderPartially(orderFillRequest, order, tokenDestination);
  }

  /**
   * @notice Fills a public order partially. The maker buy token of the order must be approved
   * for transfer to the exchange. Only whitelisted tokens can be used.
   * @param orderFillRequest Order fill request data
   * @return result swap result with data like the amount of output token received and amount
   * of input token spent
   */
  function fillPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    address tokenDestination
  ) external returns (SwapResult memory result) {
    PublicOrder memory order = orderManager.getOrder(orderFillRequest.orderId);
    return _fillPublicOrderPartially(orderFillRequest, order, tokenDestination);
  }

  function _fillPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenDestination
  ) internal nonReentrant returns (SwapResult memory result) {
    if (order.deadline != 0 && block.timestamp > order.deadline) {
      revert StarSwap__OrderExpired();
    }

    uint256 outputAmount = _fillExactInputPublicOrderPartially(
      orderFillRequest,
      order,
      tokenDestination
    );

    result = SwapResult({
      outputToken: order.makerSellToken,
      outputAmount: outputAmount,
      inputToken: order.makerBuyToken,
      inputAmount: orderFillRequest.amountIn
    });

    (order.makerBuyTokenAmount, order.makerSellTokenAmount, , ) = OrderLib
      .calculateOrderAmountsAfterFill(orderFillRequest, order);
    orderManager.updateOrder(orderFillRequest.orderId, order);

    emit PublicOrderPartiallyFilled(orderFillRequest.orderId, _msgSender());

    return result;
  }

  function _fillExactInputPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenDestination
  ) internal returns (uint256 fillAmountOut) {
    (, , , fillAmountOut) = OrderLib.calculateOrderAmountsAfterFill(
      orderFillRequest,
      order
    );

    PublicOrder memory modifiedOrder = PluginLib.runBeforeOrderFill(
      pluginCallConfigs,
      // for partial fill we need to prepare a hypotetical order with the acutal amount of tokens that will be filled
      // in order for plugins to calculate data correctly
      PublicOrder({
        makerSellToken: order.makerSellToken,
        makerBuyToken: order.makerBuyToken,
        makerSellTokenAmount: fillAmountOut,
        makerBuyTokenAmount: orderFillRequest.amountIn,
        deadline: order.deadline
      })
    );
    fillAmountOut = modifiedOrder.makerSellTokenAmount;

    // pay the order owner
    IERC20(modifiedOrder.makerBuyToken).safeTransferFrom(
      _msgSender(),
      orderManager.ownerOf(orderFillRequest.orderId),
      orderFillRequest.amountIn
    );

    IERC20(order.makerSellToken).safeTransfer(tokenDestination, fillAmountOut);
    tokenTreasury.subtract(order.makerSellToken, fillAmountOut);

    modifiedOrder = PluginLib.runAfterOrderFill(pluginCallConfigs, modifiedOrder);
  }
}
