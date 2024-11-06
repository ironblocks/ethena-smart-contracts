# 🛡️ Ethena + Venn Firewall Integration Demo

This repository demonstrates the integration of Venn Firewall with Ethena protocol, focusing specifically on USDe minting and redemption flows. The implementation showcases how Venn's transaction firewall can be used to secure and monitor critical DeFi operations.

## 🚀 Quick Start

1. Clone this repository
2. Install dependencies:
   ```bash
   cd contracts
   forge install
   ```
3. Install node dependencies:
   ```bash
   cd contracts/venn-scripts
   npm install
   ```
4. Set up your environment variables (see [Environment Setup](#️-environment-setup))
5. Follow the deployment and execution flow below

## 🔄 Deployment and Execution Flow

### 1. Deploy Contracts
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```
This deploys the Ethena contracts to the network.

### 2. Set up Venn CLI and Environment
```bash
# Install Venn CLI globally
npm i -g @vennbuild/cli
```
Set up your environment variables and create venn.config.json (see [Environment Setup](#-environment-setup) and [Venn Configuration](#-venn-configuration))

### 3. Enable Venn Policy
```bash
venn enable --network holesky
```
Add the generated policy address to your venn.config.json under the "ApprovedCalls" field.

### 4. Grant Signer Role
```bash
node contracts/venn-scripts/grant-signer.js
```
Grants the signer role to the deployer, enabling them to approve calls to the Venn Firewall policy.

### 5. Approve Calls
```bash
node contracts/venn-scripts/approve-calls.js
```
Approves the necessary calls to the Venn Firewall policy. This is required before any minting or redemption can occur.

### 6. Mint USDe
```bash
node contracts/venn-scripts/mint.js
```
Executes the minting flow:
- WETH wrapping from ETH
- WETH approval for Ethena staking contract
- USDe minting through Venn Firewall

### 7. Redeem USDe
```bash
node contracts/venn-scripts/redeem.js
```
Executes the redemption flow:
- USDe approval for redemption
- Redemption process through Venn Firewall
- WETH unwrapping to ETH

## 🔍 Scope

This demo focuses on the following Ethena protocol operations:
- USDe minting process
- Token approvals
- USDe redemption flow

## 📁 Modified Files with Venn Integration

The following files have been customized to incorporate Venn Firewall:

- `contracts/contracts/EthenaMinting.sol`
- `contracts/contracts/USDe.sol`

## 🔗 Example Transactions (Holesky Testnet)

View example transactions of the integration in action on Holesky testnet:

- USDe Minting: [0xd672f06c9d518de1e918b0f138d8636f7fa74dc39c3617aa6e60f0903cfe8003](https://holesky.etherscan.io/tx/0xd672f06c9d518de1e918b0f138d8636f7fa74dc39c3617aa6e60f0903cfe8003)
- USDe Redemption: [0x20ff955f7ffabf9123bb5667d183cf2f8fb0ab66eb0c16b27787bc6252b8fc56](https://holesky.etherscan.io/tx/0x20ff955f7ffabf9123bb5667d183cf2f8fb0ab66eb0c16b27787bc6252b8fc56)

These transactions are examples of successful minting and redemption flows. They are only possible if the necessary calls are approved to the venn policy, and the transactions are sent through the Venn dApp SDK.

## ⚙️ Environment Setup

Create a `.env` file in the `contracts` directory with the following:

```env
# Network
PRIVATE_KEY=your_private_key
USER_PRIVATE_KEY=your_user_private_key // for signing orders
RPC_URL=your_holesky_rpc_url
VENN_NODE_URL=venn_node_url
VENN_PRIVATE_KEY=your_venn_api_key // should be the same as deployer private key
ETHENA_MINTING_ADDRESS=ethena_minting_address
USDE_ADDRESS=usde_address
WETH_ADDRESS=weth_address
```

## 🔐 Venn Configuration

Create a `venn.config.json` file containing firewall configurations for:

```json
{
  "networks": {
    "holesky": {
        "EthenaMinting": "...", // EthenaMinting contract address
        "USDe": "..." // USDe contract address
    },
    "ApprovedCalls": "..." // address of the deployed policy
  }
}
```

## 📚 Resources

- [Venn Firewall Documentation](https://docs.venn.build)
- [Ethena Documentation](https://docs.ethena.fi)

## ⚠️ Important Notes

- This is a demonstration project - test thoroughly before production use
- Ensure proper environment variables are set
- Monitor Venn Firewall logs for security alerts
- All transactions are executed through Venn's secure infrastructure

## 📧 Contact

For any questions or support, reach out to our integrator on telegram - [@x0b501e7e](https://t.me/x0b501e7e)
