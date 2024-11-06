const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

async function main() {
    const POLICY = process.env.VENN_POLICY_ADDRESS;
    const RPC_URL = process.env.RPC_URL;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const signerAddress = await signer.getAddress();

    const policyContract = new ethers.Contract(
        POLICY,
        [
            "function SIGNER_ROLE() external view returns (bytes32)",
            "function grantRole(bytes32 role, address account) external"
        ],
        signer
    );

    try {
        const signerRole = await policyContract.SIGNER_ROLE();
        console.log("SIGNER_ROLE:", signerRole);

        const tx = await policyContract.grantRole(signerRole, signerAddress);
        console.log("Transaction submitted:", tx.hash);
        
        await tx.wait();
        console.log(`Granted SIGNER_ROLE to ${signerAddress}`);

    } catch (error) {
        console.error("Error details:", error);
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