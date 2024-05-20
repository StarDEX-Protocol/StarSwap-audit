import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { MAX_UINT256 } from '../utils/constants';
import { getNetworkConfig } from '../networkConfigs';

const deployStarSwap: DeployFunction = async function ({ deployments, getChainId }) {
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
    (
      await get('StarSwap')
    ).address,
  );

  await mockUSDC.approve(starswap.getAddress(), MAX_UINT256);
  await mockERC20.approve(starswap.getAddress(), MAX_UINT256);
  await starswap.addTokenToWhitelist(mockUSDCAddress);
  await starswap.addTokenToWhitelist(mockERC20Address);
  await starswap.createPublicOrder({
    offeredToken: mockUSDCAddress,
    amountOffered: ethers.parseEther('1'),
    wantedToken: mockERC20Address,
    amountWanted: ethers.parseEther('2'),
    deadline: 0,
  });
  await starswap.createPublicOrder({
    offeredToken: mockERC20Address,
    amountOffered: ethers.parseEther('10'),
    wantedToken: mockUSDCAddress,
    amountWanted: ethers.parseEther('15'),
    deadline: 0,
  });
  await starswap.createPublicOrder({
    offeredToken: mockERC20Address,
    amountOffered: ethers.parseEther('10'),
    wantedToken: mockUSDCAddress,
    amountWanted: ethers.parseEther('15'),
    deadline: 0,
  });
  log('-----Mock offers added-----');
};

export default deployStarSwap;

deployStarSwap.tags = ['mocks'];
