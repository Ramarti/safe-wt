const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');
const { Decimal } = require('decimal.js');
const { BigNumber } = require('ethers');
chai.use(require('chai-decimaljs')(Decimal));

const DAY_SECONDS = 24 * 60 * 60;
const DAILY_FEE_PERCENT = '10';
const RESOLUTION = ethers.utils.parseEther('1');
const FEE_PER_SECOND_SCALED = RESOLUTION.mul(DAILY_FEE_PERCENT).div(DAY_SECONDS * 100);

async function getTimestamp(tx) {
    const { timestamp } = await ethers.provider.getBlock(tx.blockNumber);
    return timestamp;
}

function bigNumberEtherToDecimal(bn) {
    return Decimal(ethers.utils.formatEther(bn));
}

describe.only('FeeHandler', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploy() {
        // Contracts are deployed using the first signer/account by default
        const [owner, depositor] = await ethers.getSigners();

        const MockFeeHandler = await ethers.getContractFactory('MockFeeHandler');
        const feeHandler = await MockFeeHandler.deploy(FEE_PER_SECOND_SCALED, RESOLUTION);

        return { feeHandler, owner, depositor };
    }

    describe('Deployment', function () {
        it('rate is set', async function () {
            const { feeHandler } = await loadFixture(deploy);
            expect(await feeHandler.rate()).to.deep.eq([FEE_PER_SECOND_SCALED, RESOLUTION]);
        });
    });

    describe.only('Accumulator', function () {
        it('should increment with time', async function () {
            const { feeHandler } = await loadFixture(deploy);
            const depositTime = await getTimestamp(await feeHandler.incrementDeposit(ethers.utils.parseEther('100')));

            let currentFees = await feeHandler.currentFee();
            expect(currentFees).to.be.eq(ethers.constants.Zero);

            await time.increaseTo(depositTime + DAY_SECONDS * 0.5);
            currentFees = await feeHandler.currentFee();
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('5', '0.00000001');

            await time.increaseTo(depositTime + DAY_SECONDS);
            currentFees = await feeHandler.currentFee();
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('10', '0.00000001');
            // force fee accruing
            await feeHandler.incrementDeposit(0);
            // less precision because incrementDeposit's mined block time
            currentFees = await feeHandler.currentFee();
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('10', '0.001');
        });

        it('should increment with time and other deposits', async function () {
            const { feeHandler } = await loadFixture(deploy);
            let depositTime = await getTimestamp(await feeHandler.incrementDeposit(ethers.utils.parseEther('100')));

            let currentFees = await feeHandler.currentFee();
            expect(currentFees).to.be.eq(ethers.constants.Zero);

            await time.increaseTo(depositTime + DAY_SECONDS);
            currentFees = await feeHandler.currentFee();
            // after a day, fees are 10% of 100
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('10', '0.00000001');

            depositTime = await getTimestamp(await feeHandler.incrementDeposit(ethers.utils.parseEther('2000')));
            await time.increaseTo(depositTime + DAY_SECONDS);
            currentFees = await feeHandler.currentFee();
            // 100 * 0.1 + 2100 * 0.1
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('220', '0.001');
        });

        it('should increment less with time and withdrawals', async function () {
            const { feeHandler } = await loadFixture(deploy);
            let depositTime = await getTimestamp(await feeHandler.incrementDeposit(ethers.utils.parseEther('100')));

            await time.increaseTo(depositTime + DAY_SECONDS);
            let currentFees = await feeHandler.currentFee();
            // after a day, fees are 10% of 100
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('10', '0.00000001');

            depositTime = await getTimestamp(await feeHandler.decrementDeposit(ethers.utils.parseEther('50')));
            await time.increaseTo(depositTime + DAY_SECONDS);
            currentFees = await feeHandler.currentFee();
            // 100 * 0.1 + 50 * 0.1
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('15', '0.001');
        });

        it('should stop if resetted', async function () {
            const { feeHandler } = await loadFixture(deploy);
            let depositTime = await getTimestamp(await feeHandler.incrementDeposit(ethers.utils.parseEther('100')));

            await time.increaseTo(depositTime + DAY_SECONDS);
            let currentFees = await feeHandler.currentFee();
            // after a day, fees are 10% of 100
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('10', '0.00000001');

            depositTime = await getTimestamp(await feeHandler.decrementDeposit(ethers.utils.parseEther('100')));
            await time.increaseTo(depositTime + DAY_SECONDS);
            currentFees = await feeHandler.currentFee();
            // 100 * 0.1
            expect(Decimal(ethers.utils.formatEther(currentFees))).to.decimal.closeTo('10', '0.001');
        });
    });
});
