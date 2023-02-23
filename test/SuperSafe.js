const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const chai = require('chai');
const { expect } = chai;
const { ethers, network } = require('hardhat');
const { Decimal } = require('decimal.js');

chai.use(require('chai-decimaljs')(Decimal));
const eth = ethers.utils.parseEther;

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const DAY_SECONDS = 24 * 60 * 60;
const RESOLUTION = ethers.utils.parseEther('1');
const DAILY_FEE_PERCENT = Decimal('0.00005'); // 0.005% each day
const FEE_PER_SECOND_SCALED = eth(DAILY_FEE_PERCENT.toString()).div(DAY_SECONDS);

const SMALL_DEPOSIT = '1000';

/*
uint256 public constant SCALE_RESOLUTION = 1 * 10 ** 18;
    uint256 private constant SECONDS_IN_DAY = (24 * 60 * 60);
    // 0.005% --> 0.005 / 100 * SCALE_RESOLUTION = 5*10^-5 * 1*10^18
    uint256 public constant FEE_DAILY_SCALED = 5 * 10 ** (18 - 5);
    uint256 public immutable WITHDRAWAL_FEE_PER_SECOND_SCALED;
*/

async function getTimestamp(tx) {
    const { timestamp } = await ethers.provider.getBlock(tx.blockNumber);
    return timestamp;
}

function bnToDecimal(bn) {
    return Decimal(bn.toString());
}

function decimalToEth(dec) {
    return eth(dec.toString());
}

function ethBnToDecimal(bn) {
    return Decimal(ethers.utils.formatEther(bn));
}

describe('SuperSafe', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploySafe() {
        // Contracts are deployed using the first signer/account by default
        const [owner, depositor, depositor2] = await ethers.getSigners();

        const SuperSafe = await ethers.getContractFactory('SuperSafe');
        const safe = await SuperSafe.deploy(FEE_PER_SECOND_SCALED, RESOLUTION);

        const Token = await ethers.getContractFactory('MockERC20');
        const token = await Token.deploy('Bucks', 'BCK', 18);
        await token.mint(depositor.address, ethers.utils.parseEther('1000000'));
        await token.mint(depositor2.address, ethers.utils.parseEther('1000000'));

        const token2 = await Token.deploy('Plata', 'PLT', 18);
        await token2.mint(depositor.address, ethers.utils.parseEther('1000000'));
        await token2.mint(depositor2.address, ethers.utils.parseEther('1000000'));

        return { safe, token, token2, owner, depositor, depositor2 };
    }

    describe('Deployment', function () {
        it('ownership is set', async function () {
            const { safe, owner } = await loadFixture(deploySafe);
            expect(await safe.owner()).to.eq(owner.address);
        });

        it('fee per second is calculated well', async function () {
            const { safe } = await loadFixture(deploySafe);

            const [rate, resolution] = await safe.rate();
            expect(resolution).to.eq(RESOLUTION);
            expect(rate).to.eq(FEE_PER_SECOND_SCALED);

            expect(bnToDecimal(rate).div(bnToDecimal(resolution))).to.be.decimal.closeTo(
                DAILY_FEE_PERCENT.div(DAY_SECONDS),
                Decimal('0.00000001')
            );
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
            it('should fail if zero address', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, SMALL_DEPOSIT);
                await expect(
                    safe.connect(depositor).deposit(ethers.constants.AddressZero, SMALL_DEPOSIT)
                ).to.be.revertedWithCustomError(safe, 'ZeroAddress');
            });
            it('should fail if zero amount', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, SMALL_DEPOSIT);
                await expect(
                    safe.connect(depositor).deposit(token.address, 0)
                ).to.be.revertedWithCustomError(safe, 'ZeroAmount');
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

    describe('Withdrawals', function () {
        describe('Native asset', function () {
            it('should not withdraw if not deposited', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                await expect(safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS)).to.be.revertedWithCustomError(
                    safe,
                    'WithdrawalTooBig'
                );
            });

            it('should withdraw', async function () {
                const { safe, depositor } = await loadFixture(deploySafe);
                expect(await safe.availableForWithdrawal(NATIVE_TOKEN_ADDRESS, depositor.address)).to.eq(
                    ethers.constants.Zero
                );
                const depositTime = await getTimestamp(
                    await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, eth('1000'), {
                        value: eth('1000')
                    })
                );
                await time.increaseTo(depositTime + DAY_SECONDS);
                const fee = Decimal('1000').mul(DAILY_FEE_PERCENT);
                const toWithdraw = Decimal('1000').sub(fee);
                const available = ethBnToDecimal(
                    await safe.availableForWithdrawal(NATIVE_TOKEN_ADDRESS, depositor.address)
                );
                expect(available).to.be.decimal.closeTo(toWithdraw, '0.0000000001');
                const initBalance = ethBnToDecimal(await depositor.getBalance());
                await expect(safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS)).to.emit(
                    safe,
                    'WithdrawalExecuted'
                );
                // TODO, need to test the event with precission
                // .withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, await safe.availableForWithdrawal(NATIVE_TOKEN_ADDRESS, depositor.address));

                expect(ethBnToDecimal(await depositor.getBalance())).to.be.decimal.closeTo(
                    initBalance.add(toWithdraw),
                    '0.001'
                );
                expect(await safe.availableForWithdrawal(NATIVE_TOKEN_ADDRESS, depositor.address)).to.eq(
                    ethers.constants.Zero
                );
            });

            it.skip('should collect fees', async function () {
                const { safe, depositor, owner } = await loadFixture(deploySafe);
                expect(await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS)).to.eq('0');

                const depositTime = await getTimestamp(
                    await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, eth('1000'), {
                        value: eth('1000')
                    })
                );
                await time.increaseTo(depositTime + DAY_SECONDS);

                const expectedFee = Decimal('1000').mul(DAILY_FEE_PERCENT);
                const fee = ethBnToDecimal(await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS));
                expect(fee).to.be.decimal.closeTo(expectedFee, '0.0000001');
                // console.log('expectedFee', expectedFee);

                const initBalance = ethBnToDecimal(await owner.getBalance());
                // console.log(initBalance);

                await safe.connect(owner).collectFees(NATIVE_TOKEN_ADDRESS, owner.address);
                // console.log(ethBnToDecimal(await owner.getBalance()));
                expect(ethBnToDecimal(await owner.getBalance())).to.be.decimal.closeTo(
                    initBalance.add(fee),
                    '0.0000001'
                );
            });
        });

        describe('ERC20 asset', function () {
            it('should not withdraw if not deposited', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                await expect(safe.connect(depositor).withdraw(token.address)).to.be.revertedWithCustomError(
                    safe,
                    'WithdrawalTooBig'
                );
            });
            it('should withdraw', async function () {
                const { safe, token, depositor } = await loadFixture(deploySafe);
                expect(await safe.availableForWithdrawal(token.address, depositor.address)).to.eq(
                    ethers.constants.Zero
                );
                await token.connect(depositor).approve(safe.address, eth('1000'));
                const depositTime = await getTimestamp(
                    await safe.connect(depositor).deposit(token.address, eth('1000'))
                );
                await time.increaseTo(depositTime + DAY_SECONDS);
                const fee = Decimal('1000').mul(DAILY_FEE_PERCENT);
                const toWithdraw = Decimal('1000').sub(fee);
                const available = ethBnToDecimal(await safe.availableForWithdrawal(token.address, depositor.address));
                expect(available).to.be.decimal.closeTo(toWithdraw, '0.0000000001');
                const initBalance = ethBnToDecimal(await token.balanceOf(depositor.address));
                await expect(safe.connect(depositor).withdraw(token.address)).to.emit(safe, 'WithdrawalExecuted');
                // TODO, need to test the event with precission
                // .withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, await safe.availableForWithdrawal(NATIVE_TOKEN_ADDRESS, depositor.address));

                expect(ethBnToDecimal(await token.balanceOf(depositor.address))).to.be.decimal.closeTo(
                    initBalance.add(toWithdraw),
                    '0.001'
                );
                expect(await safe.availableForWithdrawal(depositor.address, depositor.address)).to.eq(
                    ethers.constants.Zero
                );
            });

            it.skip('should collect fees', async function () {});
        });
    });

    describe('Fees', function () {
        it('should not collect fees if not owner', async function () {
            const { safe, token, depositor } = await loadFixture(deploySafe);
            await expect(safe.connect(depositor).collectFees(token.address, depositor.address)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should not collect fees to a zero address', async function () {
            const { safe, token, owner } = await loadFixture(deploySafe);
            await expect(
                safe.connect(owner).collectFees(token.address, ethers.constants.AddressZero)
            ).to.be.revertedWithCustomError(safe, 'ZeroAddress');
        });

        it('should increment fees with time', async function () {
            const { safe, depositor } = await loadFixture(deploySafe);

            const depositTime = await getTimestamp(
                await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, eth('1000'), {
                    value: eth('1000')
                })
            );
            let currentFees = await safe.currentDepositorFees(NATIVE_TOKEN_ADDRESS, depositor.address);
            expect(currentFees).to.be.eq(ethers.constants.Zero);
            let ownerFees = await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS);
            expect(ownerFees).to.be.eq(ethers.constants.Zero);

            await time.increaseTo(depositTime + DAY_SECONDS * 0.5);
            currentFees = await safe.currentDepositorFees(NATIVE_TOKEN_ADDRESS, depositor.address);

            expect(ethBnToDecimal(currentFees)).to.decimal.closeTo(
                Decimal('1000').mul(DAILY_FEE_PERCENT).mul(0.5),
                '0.00000001'
            );
            ownerFees = await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS);
            expect(ownerFees).to.be.eq(currentFees);

            await time.increaseTo(depositTime + DAY_SECONDS);
            currentFees = await safe.currentDepositorFees(NATIVE_TOKEN_ADDRESS, depositor.address);
            expect(ethBnToDecimal(currentFees)).to.decimal.closeTo(
                Decimal('1000').mul(DAILY_FEE_PERCENT),
                '0.00000001'
            );
            ownerFees = await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS);
            expect(ownerFees).to.be.eq(currentFees);
        });

        it('should not withdraw if all the fees go the owner', async function () {
            const { safe, depositor } = await loadFixture(deploySafe);
            await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, eth('1000'), {
                value: eth('1000')
            });
            await time.increase(10000000000000000000000000);
            expect(await safe.currentDepositorFees(NATIVE_TOKEN_ADDRESS, depositor.address)).to.be.zero;
            expect(await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS)).to.eq(eth('1000'));
        });

        describe('Multi asset', async function () {
            it('should increment fees with time and other deposits', async function () {
                const { safe, token, token2, depositor, depositor2 } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, ethers.constants.MaxUint256);
                await token.connect(depositor2).approve(safe.address, ethers.constants.MaxUint256);
                await token2.connect(depositor2).approve(safe.address, ethers.constants.MaxUint256);

                // disable automine so deposits are instantaneous to simplify math
                await network.provider.send('evm_setAutomine', [false]);
                await safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, eth('1000'), {
                    value: eth('1000')
                });
                await safe.connect(depositor).deposit(token.address, eth('500'));
                await safe.connect(depositor2).deposit(token.address, eth('2000'));
                await safe.connect(depositor2).deposit(token2.address, eth('2000'));
                await network.provider.send('evm_setAutomine', [true]);
                await network.provider.send('evm_mine');

                expect(await safe.currentDepositorFees(NATIVE_TOKEN_ADDRESS, depositor.address)).to.be.zero;
                expect(await safe.currentDepositorFees(token.address, depositor.address)).to.be.zero;
                expect(await safe.currentDepositorFees(token.address, depositor2.address)).to.be.zero;
                expect(await safe.currentDepositorFees(token2.address, depositor2.address)).to.be.zero;

                expect(await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS)).to.be.zero;
                expect(await safe.currentOwnerFees(token.address)).to.be.zero;
                expect(await safe.currentOwnerFees(token2.address)).to.be.zero;

                await time.increase(DAY_SECONDS);

                // 1000 -> dep1 / n
                expect(await safe.availableForWithdrawal(NATIVE_TOKEN_ADDRESS, depositor.address)).to.be.closeTo(
                    decimalToEth(Decimal('1000').mul(Decimal('1').sub(DAILY_FEE_PERCENT))),
                    eth('0.0000001')
                );
                expect(await safe.currentDepositorFees(NATIVE_TOKEN_ADDRESS, depositor.address)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('1000')),
                    eth('0.0000001')
                );
                // 500 -> dep1 / t1
                expect(await safe.availableForWithdrawal(token.address, depositor.address)).to.be.closeTo(
                    decimalToEth(Decimal('500').mul(Decimal('1').sub(DAILY_FEE_PERCENT))),
                    eth('0.0000001')
                );
                expect(await safe.currentDepositorFees(token.address, depositor.address)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('500')),
                    eth('0.0000001')
                );
                // 2000 -> dep2 / t1
                expect(await safe.availableForWithdrawal(token.address, depositor2.address)).to.be.closeTo(
                    decimalToEth(Decimal('2000').mul(Decimal('1').sub(DAILY_FEE_PERCENT))),
                    eth('0.0000001')
                );
                expect(await safe.currentDepositorFees(token.address, depositor2.address)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('2000')),
                    eth('0.0000001')
                );
                // 2000 -> dep2 / t2
                expect(await safe.availableForWithdrawal(token2.address, depositor2.address)).to.be.closeTo(
                    decimalToEth(Decimal('2000').mul(Decimal('1').sub(DAILY_FEE_PERCENT))),
                    eth('0.0000001')
                );
                expect(await safe.currentDepositorFees(token2.address, depositor2.address)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('2000')),
                    eth('0.0000001')
                );
                
                expect(await safe.currentOwnerFees(NATIVE_TOKEN_ADDRESS)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('1000')),
                    eth('0.0000001')
                );
                expect(await safe.currentOwnerFees(token.address)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('2500')),
                    eth('0.0000001')
                );
                expect(await safe.currentOwnerFees(token2.address)).to.be.closeTo(
                    decimalToEth(DAILY_FEE_PERCENT.mul('2000')),
                    eth('0.0000001')
                );
            });

            it.skip('should work with ERC20 of decimals other than 18');
        });
    });
});
