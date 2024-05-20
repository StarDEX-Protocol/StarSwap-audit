import { ethers } from 'hardhat';

export async function deployStarSwap() {
  const StarSwapFactory = await ethers.getContractFactory('StarSwap');
  const starSwap = await StarSwapFactory.deploy();

  const starSwapOrderManagerAddress = await starSwap.orderManager();
  const starSwapOrderManager = await ethers.getContractAt(
    'StarSwapOrderManager',
    starSwapOrderManagerAddress,
  );

  const StarSwapBatchExecutorFactory = await ethers.getContractFactory(
    'StarSwapBatchExecutor',
  );
  const starSwapBatchExecutor = await StarSwapBatchExecutorFactory.deploy(
    starSwap.getAddress(),
  );

  const PrivateOrderExecutorFactory = await ethers.getContractFactory(
    'StarSwapPrivateOrderExecutor',
  );

  const privateOrderExecutor = await PrivateOrderExecutorFactory.deploy(
    starSwap.getAddress(),
  );

  return { starSwap, starSwapOrderManager, starSwapBatchExecutor, privateOrderExecutor };
}
