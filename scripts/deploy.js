const { ethers, network } = require('hardhat');
const { Decimal } = require('decimal.js');
const { readFileSync, writeFileSync } = require('fs');

const DAY_SECONDS = 24 * 60 * 60;
const RESOLUTION = ethers.utils.parseEther('1');
const DAILY_FEE_PERCENT = Decimal('0.00005'); // 0.005% each day
const FEE_PER_SECOND_SCALED = ethers.utils.parseEther(DAILY_FEE_PERCENT.toString()).div(DAY_SECONDS);

function readDeployment(networkName) {
    const deployment = JSON.parse(readFileSync('./.deployments.json'));
    if (!deployment[networkName]) {
        deployment[networkName] = {}
    }
    return deployment
}

function writeDeployment(deployment) {
    return writeFileSync('./.deployments.json',JSON.stringify(deployment, null, 2));
}


async function deploy() {
    const [owner, depositor] = await ethers.getSigners();
    const { name } = await network;

    const deployment = readDeployment(name);
    console.log('deployer', await owner.getAddress());
    console.log('Deploying safe...');
    const SuperSafe = await ethers.getContractFactory('SuperSafe');
    const safe = await SuperSafe.deploy(FEE_PER_SECOND_SCALED, RESOLUTION);
    await safe.deployed();
    deployment[name].safe = safe.address;
    console.log(safe.address);
    

    console.log('Deploying Token...');

    const Token = await ethers.getContractFactory('MockERC20');
    const token = await Token.deploy('Bucks', 'BCK', 18);
    await token.deployed();
    deployment[name].token = token.address;
    console.log(token.address);
    
    writeDeployment(deployment);
    
    await token.mint(depositor.address, ethers.utils.parseEther('1000000'));


    return { safe, token, owner, depositor };
}

if (require.main === module) {
    deploy()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = deploy;
