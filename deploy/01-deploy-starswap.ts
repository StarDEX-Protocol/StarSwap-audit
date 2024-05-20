import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployStarSwap: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const starswapDeployment = await deploy('StarSwap', {
    from: deployer,
    args: [],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(starswapDeployment.address, starswapDeployment.args!);
  }

  const starswap = await ethers.getContractAt('StarSwap', starswapDeployment.address);
  log(`Order manager deployed at ${await starswap.orderManager()}`);

  const batchExecutorDeployment = await deploy('StarSwapBatchExecutor', {
    from: deployer,
    args: [starswapDeployment.address],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(batchExecutorDeployment.address, batchExecutorDeployment.args!);
  }
  log('-----StarSwap deployed-----');
};

export default deployStarSwap;

deployStarSwap.tags = ['starswap'];
