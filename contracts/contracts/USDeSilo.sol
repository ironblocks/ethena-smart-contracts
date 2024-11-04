// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

/* solhint-disable var-name-mixedcase  */

import {VennFirewallConsumer} from "@ironblocks/firewall-consumer/contracts/consumers/VennFirewallConsumer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/interfaces/IUSDeSiloDefinitions.sol";

/**
 * @title USDeSilo
 * @notice The Silo allows to store USDe during the stake cooldown process.
 */
contract USDeSilo is VennFirewallConsumer, IUSDeSiloDefinitions {
  address immutable _STAKING_VAULT;
  IERC20 immutable _USDE;

  constructor(address stakingVault, address usde) {
    _STAKING_VAULT = stakingVault;
    _USDE = IERC20(usde);
  }

  modifier onlyStakingVault() {
    if (msg.sender != _STAKING_VAULT) revert OnlyStakingVault();
    _;
  }

  function withdraw(address to, uint256 amount) external onlyStakingVault firewallProtected {
    _USDE.transfer(to, amount);
  }
}
