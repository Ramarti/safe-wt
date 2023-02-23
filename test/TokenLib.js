const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');
const { Decimal } = require('decimal.js');
chai.use(require('chai-decimaljs')(Decimal));

describe('TokenLib', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploy() {
        // Contracts are deployed using the first signer/account by default
        const [owner, depositor] = await ethers.getSigners();

        const MockTokenLib = await ethers.getContractFactory('MockTokenLib');
        const tokenLib = await MockTokenLib.deploy();

        return { tokenLib, owner, depositor };
    }

    describe('Noops', function () {
        it('native safeTransferFrom', async function () {
            const { tokenLib, owner } = await loadFixture(deploy);
            await expect(
                await tokenLib.noopTransferFrom()
            ).to.changeEtherBalances([owner, tokenLib], [0, 0]);
        });
    });
});
