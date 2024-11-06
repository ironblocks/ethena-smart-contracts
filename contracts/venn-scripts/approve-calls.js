// js-scripts/venn/approve-calls.js
const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });
async function main() {
    // ============= SETUP AND CONNECTIONS =============
    // Contract addresses
    const MINTING = "0xe61759da3274c510d8212142e366d0cf865c3153";
    const USDE = "0x946d6fe371117dda7d380cb447f941323986ff23";
    const WETH = "0xeb44608765dce849d9afddf44bf0f36120d0b26f";
    const POLICY = process.env.VENN_POLICY_ADDRESS;
    const RPC_URL = process.env.RPC_URL;
    
    // Setup provider and ethenaBackend signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const ethenaBackend = await signer.getAddress();
    console.log("Using ethenaBackend address:", ethenaBackend);

    // Connect to contracts
    const policyContract = new ethers.Contract(
        POLICY,
        [
            "function approveCalls(bytes32[] calldata _callHashes, uint256 expiration, address txOrigin) external",
            "function getCallHash(address consumer, address sender, address origin, bytes memory data, uint256 value) public pure returns (bytes32)",
            "function hasRole(bytes32 role, address account) external view returns (bool)",
            "function approvedCalls(address) view returns (bytes32[] memory)",
            "function approvedCallsExpiration(address) view returns (uint256)"
        ],
        signer
    );

    const mintingContract = new ethers.Contract(
        MINTING,
        require('../out/EthenaMinting.sol/EthenaMinting.json').abi,
        signer
    );

    try {
        // Verify ethenaBackend has SIGNER_ROLE
        const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SIGNER_ROLE"));
        const hasSigner = await policyContract.hasRole(SIGNER_ROLE, ethenaBackend);
        console.log("Has SIGNER_ROLE:", hasSigner);
        if (!hasSigner) {
            throw new Error("Account does not have SIGNER_ROLE");
        }

        const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour

        // Setup user wallet for signing orders
        const userWallet = new ethers.Wallet(process.env.USER_PRIVATE_KEY, provider);
        const userAddress = await userWallet.getAddress();
        console.log("User address:", userAddress);

        // ============= MINT FLOW =============
        console.log("\n=== Processing Mint Flow ===");
        
        // 1. Create and sign mint order (from user's perspective)
        const order = {
            order_type: 0, // MINT = 0
            expiry: Math.floor(Date.now() / 1000) + 3600,
            nonce: 1,
            benefactor: userAddress,    // User sending collateral
            beneficiary: userAddress,   // User receiving USDe
            collateral_asset: WETH,
            collateral_amount: ethers.parseEther("0.5"),
            usde_amount: ethers.parseEther("1000")
        };

        // 2. Get order hash and user signature
        const orderHash = await mintingContract.hashOrder(order);
        const mintSignature = await userWallet.signMessage(ethers.getBytes(orderHash));
        const signature = {
            signature_type: 0,
            signature_bytes: mintSignature
        };

        // 3. Create route for collateral distribution
        const route = {
            addresses: [ethenaBackend],  // custodian is ethenaBackend
            ratios: [10000]             // 100% to single custodian
        };

        // 4. Generate call data for both transactions
        // EthenaMinting.mint() call data
        const mintCallData = mintingContract.interface.encodeFunctionData("mint", [
            order,
            route,
            signature
        ]);

        // USDe.mint() call data
        const usdeContract = new ethers.Contract(
            USDE,
            ["function mint(address to, uint256 amount)"],
            signer
        );
        const usdeMintCallData = usdeContract.interface.encodeFunctionData("mint", [
            order.beneficiary,
            order.usde_amount
        ]);

        // 5. Calculate mint flow call hashes (in reverse order of execution)
        const mintCallHash = ethers.keccak256(
            ethers.solidityPacked(
                ['address', 'address', 'address', 'bytes', 'uint256'],
                [
                    MINTING,                // consumer
                    ethenaBackend,          // sender
                    ethenaBackend,          // origin
                    mintCallData,
                    0                       // value
                ]
            )
        );

        const usdeMintCallHash = ethers.keccak256(
            ethers.solidityPacked(
                ['address', 'address', 'address', 'bytes', 'uint256'],
                [
                    USDE,           // consumer (USDe contract)
                    MINTING,        // sender (Minting contract)
                    ethenaBackend,  // origin (tx.origin)
                    usdeMintCallData,
                    0              // value
                ]
            )
        );


        const mintCallHashes = [usdeMintCallHash, mintCallHash];

        // Log the parameters we're using to generate the call hash
        console.log("\n=== Mint Call Parameters ===");
        console.log("Consumer (MINTING):", MINTING);
        console.log("Sender (ethenaBackend):", ethenaBackend);
        console.log("Origin (ethenaBackend):", ethenaBackend);
        console.log("Mint Call Data:", mintCallData);
        console.log("Approved Call Hash:", mintCallHashes[0]);

        console.log("\nCall Hash Details:");
        console.log("EthenaMinting call hash:", mintCallHashes[1]);
        console.log("USDe call hash:", mintCallHashes[0]);

        // 6. Approve mint flow calls
        console.log("Approving mint flow calls...");
        const mintTx = await policyContract.approveCalls(
            mintCallHashes,
            expiration,
            ethenaBackend
        );
        console.log("Mint approval tx submitted:", mintTx.hash);
        await mintTx.wait();
        console.log("Mint approval confirmed!");
        console.log("ethenaBackend:", ethenaBackend);

        // Verify storage
        console.log("\nVerification:");
        console.log("Expected hashes:", mintCallHashes);
        console.log("Expiration:", new Date(expiration * 1000).toISOString());
        const storedHashes = await policyContract.approvedCalls(ethenaBackend);
        console.log("Stored hashes:", storedHashes);

        // ============= REDEEM FLOW =============
        // console.log("\n=== Processing Redeem Flow ===");
        
        // // 1. Create redeem order (from user's perspective)
        // const redeemOrder = {
        //     order_type: 1,  // REDEEM = 1
        //     expiry: Math.floor(Date.now() / 1000) + 3600,
        //     nonce: 2,
        //     benefactor: userAddress,    // User sending USDe
        //     beneficiary: userAddress,   // User receiving WETH
        //     collateral_asset: WETH,
        //     collateral_amount: ethers.parseEther("0.25"),  // 0.25 WETH
        //     usde_amount: ethers.parseEther("500")          // 500 USDe
        // };

        // // 2. Get redeem order hash and user signature
        // const redeemOrderHash = await mintingContract.hashOrder(redeemOrder);
        // const redeemSignature = {
        //     signature_type: 0,  // EIP712 = 0
        //     signature_bytes: await userWallet.signMessage(ethers.getBytes(redeemOrderHash))
        // };

        // // 3. Generate redeem call data
        // const redeemCallData = mintingContract.interface.encodeFunctionData("redeem", [
        //     redeemOrder,
        //     redeemSignature
        // ]);

        // // 4. Calculate redeem flow call hash
        // const redeemCallHashes = [
        //     // EthenaMinting.redeem() called by ethenaBackend
        //     ethers.keccak256(
        //         ethers.solidityPacked(
        //             ['address', 'address', 'address', 'bytes', 'uint256'],
        //             [
        //                 MINTING,        // consumer
        //                 ethenaBackend,  // sender (ethenaBackend)
        //                 ethenaBackend,  // origin (ethenaBackend)
        //                 redeemCallData,
        //                 0              // value
        //             ]
        //         )
        //     )
        // ];

        // // 5. Approve redeem flow call
        // console.log("Approving redeem flow call...");
        // const redeemTx = await policyContract.approveCalls(
        //     redeemCallHashes,
        //     expiration,
        //     ethenaBackend
        // );
        // console.log("Redeem approval tx submitted:", redeemTx.hash);
        // await redeemTx.wait();
        // console.log("Redeem approval confirmed!");

    } catch (error) {
        console.error("\n=== Error Details ===");
        console.error("Error:", error);
        if (error.error?.message) {
            console.error("Provider error message:", error.error.message);
        }
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(console.error);