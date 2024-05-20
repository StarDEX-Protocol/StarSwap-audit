import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, getNamedAccounts } from 'hardhat';
import { getNetworkConfig } from '../networkConfigs';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { verifyContract } from '../utils/verifyContract';

const deployTimelock: DeployFunction = async function ({ deployments, getChainId }) {
  const { deploy, log, get } = deployments;
  const chainId = await getChainId();
  const { deployer } = await getNamedAccounts();
  const networkConfig = getNetworkConfig(chainId);

  if (chainId === '31337') {
    log('-----Skipped timelock deployment-----');
    return;
  }

  const timelockDeployment = await deploy('TimelockController', {
    from: deployer,
    args: [time.duration.hours(24), [deployer], [deployer], deployer],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(timelockDeployment.address, timelockDeployment.args!);
  }
  log('-----Timelock deployed-----');

  const starswap = await ethers.getContractAt(
    'StarSwap',
    (await get('StarSwap')).address,
  );
  await (
    await starswap.grantRole(
      await starswap.DEFAULT_ADMIN_ROLE(),
      timelockDeployment.address,
    )
  ).wait(networkConfig.confirmations);
  await (
    await starswap.grantRole(await starswap.TREASURY_OWNER(), timelockDeployment.address)
  ).wait(networkConfig.confirmations);
  await (
    await starswap.renounceRole(await starswap.DEFAULT_ADMIN_ROLE(), deployer)
  ).wait(networkConfig.confirmations);

  log('-----Ownership transferred to Timelock contract-----');
};

export default deployTimelock;

deployTimelock.tags = ['starswap', 'timelock'];
