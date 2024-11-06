import { VennClient } from '@vennbuild/venn-dapp-sdk';
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });
async function main() {
    // ============= SETUP AND CONNECTIONS =============
    const MINTING = "0xe61759da3274c510d8212142e366d0cf865c3153";
    const USDE = "0x946d6fe371117dda7d380cb447f941323986ff23";
    const WETH = "0xeb44608765dce849d9afddf44bf0f36120d0b26f";
    
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
        const usdeContract = new ethers.Contract(
            USDE,
            ["function approve(address, uint256)", "function balanceOf(address) view returns (uint256)"],
            user
        );
        
        await usdeContract.approve(MINTING, ethers.parseEther("500"));

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
            require('../../out/EthenaMinting.sol/EthenaMinting.json').abi,
            provider
        );

        const orderHash = await mintingContract.hashOrder(redeemOrder);
        const signature = {
            signature_type: 0,
            signature_bytes: await user.signMessage(ethers.getBytes(orderHash))
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
        console.log("User USDe:", await usdeContract.balanceOf(await user.getAddress()));
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