const { VennClient } = require('@vennbuild/venn-dapp-sdk');
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

async function main() {
    // ============= SETUP AND CONNECTIONS =============
    const MINTING = "0x01A6C2cd3f9F2B6e491389907b48DBeE40919f89";
    const USDE = "0x67df56d2DEc72Fb9c6AE83b55DE82c1455fe5731";
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
        // 1. User wraps ETH and approves WETH
        console.log("\nUser wrapping ETH and approving WETH...");
        const weth = new ethers.Contract(
            WETH,
            ["function deposit() payable", "function approve(address, uint256)"],
            user
        );
        
        // await weth.deposit({ value: ethers.parseEther("0.5") });
        await weth.approve(MINTING, ethers.parseEther("0.5"));

        // 2. Create and sign order as user
        const order = {
            order_type: 0, // MINT = 0
            expiry: Math.floor(Date.now() / 1000) + 3600,
            nonce: 1,
            benefactor: await user.getAddress(),
            beneficiary: await user.getAddress(),
            collateral_asset: WETH,
            collateral_amount: ethers.parseEther("0.5"),
            usde_amount: ethers.parseEther("1000")
        };

        const mintingContract = new ethers.Contract(
            MINTING,
            require('../out/EthenaMinting.sol/EthenaMinting.json').abi,
            provider
        );

        const orderHash = await mintingContract.hashOrder(order);
        const signature = {
            signature_type: 0,
            signature_bytes: user.signingKey.sign(ethers.getBytes(orderHash)).serialized
        };

        // 3. Create route for collateral
        const route = {
            addresses: [await ethenaBackend.getAddress()],
            ratios: [10000]
        };

        // 4. Generate mint transaction
        const mintCallData = mintingContract.interface.encodeFunctionData("mint", [
            order,
            route,
            signature
        ]);

        // 5. Get approval from Venn - simpler approach
        console.log("Getting Venn approval for mint...");
        console.log("signerAddress:", await ethenaBackend.getAddress());
        const approvedMintTx = await vennClient.approve({
            from: await ethenaBackend.getAddress(),
            to: MINTING,
            data: mintCallData,
            value: "0"
        });

        console.log("Full transaction data:", approvedMintTx.data);

        console.log("Executing mint transaction...");
        // return;
        const receipt = await ethenaBackend.sendTransaction({ ...approvedMintTx, gasLimit: 2000000 });
        // const receipt = await ethenaBackend.sendTransaction(approvedMintTx);
        await receipt.wait();
        console.log("Mint completed!");

        // Print balances
        const usdeContract = new ethers.Contract(
            USDE,
            ["function balanceOf(address) view returns (uint256)"],
            provider
        );
        
        console.log("\n=== Final Balances ===");
        console.log("User USDe:", await usdeContract.balanceOf(await user.getAddress()));
        console.log("User WETH:", await weth.balanceOf(await user.getAddress()));

        console.log("\nTransaction Origin Details:");
        console.log("tx.origin (executing address):", await user.getAddress());

    } catch (error) {
        console.error("\n=== Error Details ===");
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch(console.error);