const { VennClient } = require('@vennbuild/venn-dapp-sdk');
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });
async function main() {
    // ============= SETUP AND CONNECTIONS =============
    const MINTING = process.env.ETHENA_MINTING_ADDRESS;
    const USDE = process.env.USDE_ADDRESS;
    const WETH = process.env.WETH_ADDRESS;
    
    // Setup Venn client
    const vennURL = process.env.VENN_NODE_URL;
    const vennPolicyAddress = process.env.VENN_POLICY_ADDRESS;
    const vennClient = new VennClient({ vennURL, vennPolicyAddress });

    // Setup provider and signers
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const ethenaBackend = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const user = new ethers.Wallet(process.env.USER_PRIVATE_KEY, provider);

    try {
        // 0. Custodian prepares redemption funds (simulation only)
        console.log("\nCustodian preparing redemption funds...");
        const weth = new ethers.Contract(
            WETH,
            ["function approve(address, uint256)", "function transfer(address, uint256)", "function balanceOf(address) view returns (uint256)"],
            ethenaBackend  // Using ethenaBackend as custodian
        );
        
        await weth.approve(MINTING, ethers.parseEther("0.25"));
        await weth.transfer(MINTING, ethers.parseEther("0.25"));
        console.log("Custodian transferred WETH to minting contract");

        // 1. User approves USDe spending
        console.log("\nUser approving USDe...");
        
        const usde = new ethers.Contract(
            USDE,
            ["function allowance(address,address) view returns (uint256)",
             "function approve(address, uint256)"
            ],
            user
        );

        // Check allowance before
        const allowanceBefore = await usde.allowance(await user.getAddress(), MINTING);
        console.log("USDe allowance before:", ethers.formatEther(allowanceBefore));

        // Make sure approval amount matches what we're trying to redeem
        const approveTx = await usde.approve(MINTING, ethers.parseEther("500"));
        await approveTx.wait();

        // Check allowance after
        const allowanceAfter = await usde.allowance(await user.getAddress(), MINTING);
        console.log("USDe allowance after:", ethers.formatEther(allowanceAfter));

        // 2. Create and sign redeem order as user
        const redeemOrder = {
            order_type: 1, // REDEEM = 1
            expiry: Math.floor(Date.now() / 1000) + 3600,
            nonce: 2,
            benefactor: await user.getAddress(),    // User sending USDe
            beneficiary: await user.getAddress(),   // User receiving WETH
            collateral_asset: WETH,
            collateral_amount: ethers.parseEther("0.25"),  // 0.25 WETH
            usde_amount: ethers.parseEther("500")          // 500 USDe
        };

        const mintingContract = new ethers.Contract(
            MINTING,
            require('../out/EthenaMinting.sol/EthenaMinting.json').abi,
            provider
        );

        const orderHash = await mintingContract.hashOrder(redeemOrder);
        const signature = {
            signature_type: 0,
            signature_bytes: user.signingKey.sign(ethers.getBytes(orderHash)).serialized
        };

        // 3. Generate redeem transaction
        const redeemCallData = mintingContract.interface.encodeFunctionData("redeem", [
            redeemOrder,
            signature
        ]);

        // 4. Get approval from Venn and execute
        console.log("Getting Venn approval for redeem...");
        const approvedRedeemTx = await vennClient.approve({
            from: await ethenaBackend.getAddress(),
            to: MINTING,
            data: redeemCallData,
            value: 0
        });

        console.log("Executing redeem transaction...");
        const receipt = await ethenaBackend.sendTransaction(approvedRedeemTx);
        await receipt.wait();
        console.log("Redeem completed!");

        // Print balances
        console.log("\n=== Final Balances ===");
        console.log("User USDe:", await usde.balanceOf(await user.getAddress()));
        console.log("User WETH:", await weth.balanceOf(await user.getAddress()));
        console.log("Minting Contract WETH:", await weth.balanceOf(MINTING));

    } catch (error) {
        console.error("\n=== Error Details ===");
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(console.error);