import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { MAX_UINT256 } from '../utils/constants';
import { getNetworkConfig } from '../networkConfigs';

const deployMockOffers: DeployFunction = async function ({ deployments, getChainId }) {
  const { log, get } = deployments;
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  if (!networkConfig.deployMocks) {
    log('----- Skipped adding mock offers... -----');
    return;
  }

  const mockUSDCAddress = (await get('MockUSDC')).address;
  const mockERC20Address = (await get('MockERC20')).address;
  const mockUSDC = await ethers.getContractAt('MockUSDC', mockUSDCAddress);
  const mockERC20 = await ethers.getContractAt('MockERC20', mockERC20Address);
  const starswap = await ethers.getContractAt(
    'StarSwap',
    (await get('StarSwap')).address,
  );
  const tokenWhitelistPluginAddress = (await get('TokenWhitelistPlugin')).address;
  const tokenWhitelistPlugin = await ethers.getContractAt(
    'TokenWhitelistPlugin',
    tokenWhitelistPluginAddress,
  );

  await mockUSDC.approve(starswap.getAddress(), MAX_UINT256);
  await mockERC20.approve(starswap.getAddress(), MAX_UINT256);
  await tokenWhitelistPlugin.addTokenToWhitelist(mockUSDCAddress);
  await tokenWhitelistPlugin.addTokenToWhitelist(mockERC20Address);
  await starswap.createPublicOrder({
    makerSellToken: mockUSDCAddress,
    makerSellTokenAmount: ethers.parseEther('1'),
    makerBuyToken: mockERC20Address,
    makerBuyTokenAmount: ethers.parseEther('2'),
    deadline: 0,
  });
  await starswap.createPublicOrder({
    makerSellToken: mockERC20Address,
    makerSellTokenAmount: ethers.parseEther('10'),
    makerBuyToken: mockUSDCAddress,
    makerBuyTokenAmount: ethers.parseEther('15'),
    deadline: 0,
  });
  await starswap.createPublicOrder({
    makerSellToken: mockERC20Address,
    makerSellTokenAmount: ethers.parseEther('10'),
    makerBuyToken: mockUSDCAddress,
    makerBuyTokenAmount: ethers.parseEther('15'),
    deadline: 0,
  });
  log('-----Mock offers added-----');
};

export default deployMockOffers;

deployMockOffers.tags = ['mocks'];
