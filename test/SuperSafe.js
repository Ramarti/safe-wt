const {
    // time,
    loadFixture
} = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require('chai');

describe('SuperSafe', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploySafe() {
        // Contracts are deployed using the first signer/account by default
        const [owner, depositor] = await ethers.getSigners();

        const SuperSafe = await ethers.getContractFactory('SuperSafe');
        const safe = await SuperSafe.deploy();
        await safe.deployed();

        return { safe, owner, depositor };
    }

    describe('Deployment', function () {
        it('Deployment is correctly configured', async function () {
            const { safe } = await loadFixture(deploySafe);
            expect(safe.address).to.exist;
        });

        it.skip('Should set the right owner', async function () {});
    });
});
