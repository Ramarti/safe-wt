// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { TokenLib } from "./token/TokenLib.sol";
import { InputSanitizer } from "./utils/InputSanitizer.sol";
import { SafeEntryManager } from "./utils/SafeEntryManager.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

contract SuperSafe is InputSanitizer, SafeEntryManager, ReentrancyGuard, Ownable2Step {
    using Address for address payable;
    using TokenLib for TokenLib.Token;

    event DepositReceived(TokenLib.Token indexed token, address indexed depositor, uint256 amount);
    event WithdrawalExecuted(TokenLib.Token indexed token, address indexed depositor, uint256 amount);
    event FeeAccrued(TokenLib.Token indexed token, uint256 amount);
    event FeeWithdrawalExecuted(TokenLib.Token indexed token, address destination, uint256 amount);

    error NativeDepositUnderfunded();
    error NonNativeDepositMustNotSendNative();
    error WithdrawalTooBig();

    // depositor => token => amount
    mapping(address => mapping(TokenLib.Token => SafeEntry)) private _entries;
    mapping(TokenLib.Token => SafeEntry) private _ownerFees;

    constructor(uint256 __rate, uint256 __resolution) SafeEntryManager(__rate, __resolution) Ownable2Step() {}

    function deposit(TokenLib.Token token, uint256 amount) external payable nonReentrant nonZeroToken(token) nonZeroAmount(amount) {
        if (token.isNative()) {
            if (msg.value < amount) {
                revert NativeDepositUnderfunded();
            }
            if (msg.value > amount) {
                payable(msg.sender).sendValue(msg.value - amount);
            }
        } else {
            if (msg.value != 0) {
                revert NonNativeDepositMustNotSendNative();
            }
            token.transferFrom(msg.sender, address(this), amount);
        }
        _incrementDeposit(_entries[msg.sender][token], amount);
        _incrementDeposit(_ownerFees[token], amount);

        emit DepositReceived(token, msg.sender, amount);
    }

    function withdraw(TokenLib.Token token) external nonReentrant {
        SafeEntry storage se = _entries[msg.sender][token];
        uint256 amount = availableForWithdrawal(token, msg.sender);
        if (amount == 0) {
            revert WithdrawalTooBig();
        }
        _decrementDeposit(se, se.deposit);
        _decrementDeposit(_ownerFees[token], se.deposit);

        token.transfer(msg.sender, amount);
        emit WithdrawalExecuted(token, msg.sender, amount);
    }

    function collectFees(TokenLib.Token token, address to) external nonZeroAddress(to) onlyOwner nonReentrant {
        uint256 amount = currentOwnerFees(token);
        if (amount == 0) {
            revert WithdrawalTooBig();
        }
        _decrementDeposit(_ownerFees[token], amount);
        token.transfer(to, amount);
        emit FeeWithdrawalExecuted(token, to, amount);
    }

    function depositedFor(address depositor, TokenLib.Token token) external view returns (uint256) {
        return _entries[depositor][token].deposit;
    }

    function availableForWithdrawal(TokenLib.Token token, address depositor) public view returns(uint256) {
        uint256 deposited = _entries[depositor][token].deposit;
        uint256 currentFee = _currentFee(_entries[depositor][token]);
        if (currentFee >= deposited || deposited == 0) {
            return 0;
        }
        return deposited - currentFee;
    }

    function currentDepositorFees(TokenLib.Token token, address depositor) external view returns (uint256) {
        return Math.min(_currentFee(_entries[depositor][token]), _entries[depositor][token].deposit);
    }

    /**
     * Returns the current owner fees for a token. 
     * @param token address
     */
    function currentOwnerFees(TokenLib.Token token) public view returns (uint256) {
        return Math.min(_currentFee(_ownerFees[token]), _ownerFees[token].deposit);
    }
}
