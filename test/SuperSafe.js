const {
    // time,
    loadFixture
} = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require('chai');
const { ethers } = require('hardhat');

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

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
    });

    describe('Deposits', function () {
        const DEPOSIT_AMOUNT = 1000;
        describe('Native asset', async function () {
            it('should deposit asset', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    await safe
                        .connect(depositor)
                        .deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT })
                ).to.changeEtherBalances([safe, depositor], [DEPOSIT_AMOUNT, -DEPOSIT_AMOUNT]);
                expect(await safe.deposits(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(DEPOSIT_AMOUNT);
            });
            it('should fail if underfunded', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT - 1 })
                ).to.be.revertedWithCustomError(safe, 'NativeDepositUnderfunded');
            });

            it('should return extra balance', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    await safe
                        .connect(depositor)
                        .deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT + 555 })
                ).to.changeEtherBalances([safe, depositor], [DEPOSIT_AMOUNT, -DEPOSIT_AMOUNT]);
                expect(await safe.deposits(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(DEPOSIT_AMOUNT);
            });
            it('should emit event', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT })
                ).to.emit(safe, 'DepositReceived').withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, DEPOSIT_AMOUNT);
            });
        });
    });
});
