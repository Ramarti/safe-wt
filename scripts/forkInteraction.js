const { ethers, network } = require('hardhat');
const { readDeployment } = require('./utils/deployment');
const eth = ethers.utils.parseEther;
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

async function loadEnv() {
    const { name } = await network;
    const deployment = readDeployment(name);
    const SuperSafe = await ethers.getContractFactory('SuperSafe');
    const safe = await SuperSafe.attach(deployment[name].safe);
    const Token = await ethers.getContractFactory('MockERC20');
    const token = await Token.attach(deployment[name].token);
    const [owner, depositor] = await ethers.getSigners();
    return { deployment, safe, token, owner, depositor };
}

async function interact() {
    const { safe, token, owner, depositor } = await loadEnv();
    

    console.log('---> Depositing Eth...');
    let tx = await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, eth('1'), { value: eth('1') });
    console.log(await tx.wait());

    console.log('---> Approving...');
    tx = await token.connect(depositor).approve(safe.address, eth('1000000000'));
    console.log(await tx.wait());

    console.log('---> Depositing Token...');
    tx = await safe.connect(depositor).deposit(token.address, eth('1'));
    console.log(await tx.wait());

    console.log('---> Withdrawing Token...');
    tx = await safe.connect(depositor).withdraw(token.address);
    console.log(await tx.wait());

    console.log('---> Collecting Fees..');
    tx = await safe.connect(owner).withdraw(NATIVE_TOKEN_ADDRESS);
    console.log(await tx.wait());

}

if (require.main === module) {
    interact()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = interact;
