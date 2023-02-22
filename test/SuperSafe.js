const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const chai = require('chai');
const { expect } = chai;
const { ethers } = require('hardhat');
const { Decimal } = require('decimal.js');
chai.use(require('chai-decimaljs')(Decimal));

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const DAY_SECONDS = 24 * 60 * 60;
const SMALL_DEPOSIT = '1000';
const ETHER_DEPOSIT = ethers.utils.parseEther('1');
const DAILY_FEE_PERCENT = Decimal('0.005').div('100');
const FEE_PER_SECOND = DAILY_FEE_PERCENT.div(DAY_SECONDS);

async function getTimestamp(tx) {
    const { timestamp } = await ethers.provider.getBlock(tx.blockNumber);
    return timestamp;
}

function bigNumberEtherToDecimal(bn) {
    return Decimal(ethers.utils.formatEther(bn));
}

describe('SuperSafe', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploySafe() {
        // Contracts are deployed using the first signer/account by default
        const [owner, depositor] = await ethers.getSigners();

        const SuperSafe = await ethers.getContractFactory('SuperSafe');
        const safe = await SuperSafe.deploy();

        const Token = await ethers.getContractFactory('MockERC20');
        const token = await Token.deploy('Bucks', 'BCK', 18);
        await token.mint(depositor.address, ethers.utils.parseEther('1000000'));

        return { safe, token, owner, depositor };
    }

    async function deploySafeAndDepositNative() {
        const testEnv = await deploySafe();
        await testEnv.safe
            .connect(testEnv.depositor)
            .deposit(NATIVE_TOKEN_ADDRESS, ETHER_DEPOSIT, { value: ETHER_DEPOSIT });
        return { ...testEnv, depAmount: ETHER_DEPOSIT };
    }

    async function deploySafeAndDepositERC20() {
        const testEnv = await deploySafe();
        await testEnv.token.connect(testEnv.depositor).approve(testEnv.safe.address, ETHER_DEPOSIT);
        await testEnv.safe.connect(testEnv.depositor).deposit(testEnv.token.address, ETHER_DEPOSIT);
        return { ...testEnv, depAmount: ETHER_DEPOSIT };
    }

    describe('Deployment', function () {
        it ('ownership is set', async function () {
            const { safe, owner } = await loadFixture(deploySafe);
            expect(await safe.owner()).to.eq(owner.address);

        });

        it('fee per second is calculated well', async function () {
            const { safe } = await loadFixture(deploySafe);

            const contractScaledFeePerSecond = Decimal((await safe.WITHDRAWAL_FEE_PER_SECOND_SCALED()).toString());
            const precision = Decimal((await safe.SCALE_RESOLUTION()).toString());
            const deScaledFeePerSecond = contractScaledFeePerSecond.div(precision);
            expect(deScaledFeePerSecond).to.be.decimal.closeTo(FEE_PER_SECOND, Decimal('0.00000001'));
        });
    });

    describe('Deposits', function () {
        describe('Native asset', async function () {
            it('should deposit asset', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, SMALL_DEPOSIT, { value: SMALL_DEPOSIT })
                ).to.changeEtherBalances([safe, depositor], [SMALL_DEPOSIT, -SMALL_DEPOSIT]);
                expect(await safe.depositedFor(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(SMALL_DEPOSIT);

                await expect(
                    await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, SMALL_DEPOSIT, { value: SMALL_DEPOSIT })
                ).to.changeEtherBalances([safe, depositor], [SMALL_DEPOSIT, -SMALL_DEPOSIT]);
                expect(await safe.depositedFor(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(SMALL_DEPOSIT * 2);
            });
            it('should fail if underfunded', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, SMALL_DEPOSIT, { value: SMALL_DEPOSIT - 1 })
                ).to.be.revertedWithCustomError(safe, 'NativeDepositUnderfunded');
            });

            it('should return extra balance', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    await safe
                        .connect(depositor)
                        .deposit(NATIVE_TOKEN_ADDRESS, SMALL_DEPOSIT, { value: SMALL_DEPOSIT + 555 })
                ).to.changeEtherBalances([safe, depositor], [SMALL_DEPOSIT, -SMALL_DEPOSIT]);
                expect(await safe.depositedFor(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(SMALL_DEPOSIT);
            });
            it('should emit event', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(
                    safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, SMALL_DEPOSIT, { value: SMALL_DEPOSIT })
                )
                    .to.emit(safe, 'DepositReceived')
                    .withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, SMALL_DEPOSIT);
            });
        });

        describe('ERC20 asset', async function () {
            it('should deposit asset', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, SMALL_DEPOSIT * 2);
                await expect(
                    await safe.connect(depositor).deposit(token.address, SMALL_DEPOSIT)
                ).to.changeTokenBalances(token, [safe, depositor], [SMALL_DEPOSIT, -SMALL_DEPOSIT]);
                expect(await safe.depositedFor(depositor.address, token.address)).to.eq(SMALL_DEPOSIT);

                await token.connect(depositor).approve(safe.address, SMALL_DEPOSIT);
                await expect(
                    await safe.connect(depositor).deposit(token.address, SMALL_DEPOSIT)
                ).to.changeTokenBalances(token, [safe, depositor], [SMALL_DEPOSIT, -SMALL_DEPOSIT]);
                expect(await safe.depositedFor(depositor.address, token.address)).to.eq(SMALL_DEPOSIT * 2);
            });
            it('should fail if sending native for erc20 deposit', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, SMALL_DEPOSIT);
                await expect(
                    safe.connect(depositor).deposit(token.address, SMALL_DEPOSIT, { value: SMALL_DEPOSIT })
                ).to.be.revertedWithCustomError(safe, 'NonNativeDepositMustNotSendNative');
            });
            it('should emit event', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, SMALL_DEPOSIT);
                await expect(safe.connect(depositor).deposit(token.address, SMALL_DEPOSIT))
                    .to.emit(safe, 'DepositReceived')
                    .withArgs(token.address, depositor.address, SMALL_DEPOSIT);
            });
        });
    });

    describe('Fees', function () {
        describe('Native asset', async function () {
            it('should calculate fees over time 1 deposit', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);

                const depositTime = await getTimestamp(
                    await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, ETHER_DEPOSIT, { value: ETHER_DEPOSIT })
                );
                let currentFees = await safe.currentFees(NATIVE_TOKEN_ADDRESS, depositor.address);
                expect(currentFees).to.be.eq(ethers.constants.Zero);

                await time.increaseTo(depositTime + DAY_SECONDS * 0.5);
                currentFees = await safe.currentFees(NATIVE_TOKEN_ADDRESS, depositor.address);
                currentFees = bigNumberEtherToDecimal(currentFees);
                expect(currentFees).to.decimal.closeTo(DAILY_FEE_PERCENT.mul(0.5), '0.00000001');

                await time.increaseTo(depositTime + DAY_SECONDS);
                currentFees = await safe.currentFees(NATIVE_TOKEN_ADDRESS, depositor.address);
                currentFees = bigNumberEtherToDecimal(currentFees);
                expect(currentFees).to.decimal.closeTo(DAILY_FEE_PERCENT, '0.00000001');
            });
        });
    });
    describe('Withdrawals', function () {
        describe('Native asset', function () {
            it('should not withdraw if not deposited', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS)).to.be.revertedWithCustomError(
                    safe,
                    'NothingToWithdraw'
                );
            });
            it('should withdraw', async function () {
                const { safe, depositor, depAmount } = await loadFixture(deploySafeAndDepositNative);
                await expect(await safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS)).to.changeEtherBalance(
                    depositor,
                    depAmount
                );
            });

            it('should emit event', async function () {
                const { safe, depositor, depAmount } = await loadFixture(deploySafeAndDepositNative);
                await expect(safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS))
                    .to.emit(safe, 'WithdrawalExecuted')
                    .withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, depAmount);
            });
        });

        describe('ERC20 asset', function () {
            it('should not withdraw if not deposited', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await expect(safe.connect(depositor).withdraw(token.address)).to.be.revertedWithCustomError(
                    safe,
                    'NothingToWithdraw'
                );
            });
            it('should withdraw', async function () {
                const { safe, token, depositor, depAmount } = await loadFixture(deploySafeAndDepositERC20);
                await expect(await safe.connect(depositor).withdraw(token.address)).to.changeTokenBalance(
                    token,
                    depositor,
                    depAmount
                );
            });

            it('should emit event', async function () {
                const { safe, token, depositor, depAmount } = await loadFixture(deploySafeAndDepositERC20);
                await expect(safe.connect(depositor).withdraw(token.address))
                    .to.emit(safe, 'WithdrawalExecuted')
                    .withArgs(token.address, depositor.address, depAmount);
            });
        });
    });
});
