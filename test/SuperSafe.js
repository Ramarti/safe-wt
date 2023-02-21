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

        const Token = await ethers.getContractFactory('MockERC20');
        const token = await Token.deploy('Bucks', 'BCK', 18);
        await token.mint(depositor.address, ethers.utils.parseEther('1000000'));
        const DEPOSIT_AMOUNT = 1000;
        await token.connect(depositor).approve(safe.address, DEPOSIT_AMOUNT);

        return { safe, token, owner, depositor, DEPOSIT_AMOUNT };
    }

    async function deploySafeAndDepositNative() {
        const testEnv = await deploySafe();
        await testEnv.safe
            .connect(testEnv.depositor)
            .deposit(NATIVE_TOKEN_ADDRESS, testEnv.DEPOSIT_AMOUNT, { value: testEnv.DEPOSIT_AMOUNT });
        return testEnv;
    }

    async function deploySafeAndDepositERC20() {
        const testEnv = await deploySafe();
        await testEnv.token.connect(testEnv.depositor).approve(testEnv.safe.address, testEnv.DEPOSIT_AMOUNT);
        await testEnv.safe.connect(testEnv.depositor).deposit(testEnv.token.address, testEnv.DEPOSIT_AMOUNT);
        return testEnv;
    }

    describe('Deployment', function () {
        it('Deployment is correctly configured', async function () {
            const { safe } = await loadFixture(deploySafe);
            expect(safe.address).to.exist;
        });
    });

    describe('Deposits', function () {
        describe('Native asset', async function () {
            it('should deposit asset', async function () {
                const { safe, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await expect(
                    await safe
                        .connect(depositor)
                        .deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT })
                ).to.changeEtherBalances([safe, depositor], [DEPOSIT_AMOUNT, -DEPOSIT_AMOUNT]);
                expect(await safe.deposits(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(DEPOSIT_AMOUNT);
            });
            it('should fail if underfunded', async function () {
                const { safe, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await expect(
                    safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT - 1 })
                ).to.be.revertedWithCustomError(safe, 'NativeDepositUnderfunded');
            });

            it('should return extra balance', async function () {
                const { safe, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await expect(
                    await safe
                        .connect(depositor)
                        .deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT + 555 })
                ).to.changeEtherBalances([safe, depositor], [DEPOSIT_AMOUNT, -DEPOSIT_AMOUNT]);
                expect(await safe.deposits(depositor.address, NATIVE_TOKEN_ADDRESS)).to.eq(DEPOSIT_AMOUNT);
            });
            it('should emit event', async function () {
                const { safe, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await expect(
                    safe.connect(depositor).deposit(NATIVE_TOKEN_ADDRESS, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT })
                )
                    .to.emit(safe, 'DepositReceived')
                    .withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, DEPOSIT_AMOUNT);
            });
        });

        describe('ERC20 asset', async function () {
            it('should deposit asset', async function () {
                const { safe, token, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await expect(
                    await safe.connect(depositor).deposit(token.address, DEPOSIT_AMOUNT)
                ).to.changeTokenBalances(token, [safe, depositor], [DEPOSIT_AMOUNT, -DEPOSIT_AMOUNT]);
                expect(await safe.deposits(depositor.address, token.address)).to.eq(DEPOSIT_AMOUNT);
            });
            it('should fail if sending native for erc20 deposit', async function () {
                const { safe, token, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, DEPOSIT_AMOUNT);
                await expect(
                    safe.connect(depositor).deposit(token.address, DEPOSIT_AMOUNT, { value: DEPOSIT_AMOUNT })
                ).to.be.revertedWithCustomError(safe, 'NonNativeDepositMustNotSendNative');
            });
            it('should emit event', async function () {
                const { safe, token, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafe);
                await token.connect(depositor).approve(safe.address, DEPOSIT_AMOUNT);
                await expect(safe.connect(depositor).deposit(token.address, DEPOSIT_AMOUNT))
                    .to.emit(safe, 'DepositReceived')
                    .withArgs(token.address, depositor.address, DEPOSIT_AMOUNT);
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
                const { safe, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafeAndDepositNative);
                await expect(await safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS)).to.changeEtherBalances(
                    [safe, depositor],
                    [-DEPOSIT_AMOUNT, DEPOSIT_AMOUNT]
                );
            });

            it('should emit event', async function () {
                const { safe, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafeAndDepositNative);
                await expect(safe.connect(depositor).withdraw(NATIVE_TOKEN_ADDRESS))
                    .to.emit(safe, 'WithdrawalExecuted')
                    .withArgs(NATIVE_TOKEN_ADDRESS, depositor.address, DEPOSIT_AMOUNT);
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
                const { safe, token, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafeAndDepositERC20);
                await expect(await safe.connect(depositor).withdraw(token.address)).to.changeTokenBalances(
                    token,
                    [safe, depositor],
                    [-DEPOSIT_AMOUNT, DEPOSIT_AMOUNT]
                );
            });

            it('should emit event', async function () {
                const { safe, token, depositor, DEPOSIT_AMOUNT } = await loadFixture(deploySafeAndDepositERC20);
                await expect(safe.connect(depositor).withdraw(token.address))
                    .to.emit(safe, 'WithdrawalExecuted')
                    .withArgs(token.address, depositor.address, DEPOSIT_AMOUNT);
            });
        });
    });
});
