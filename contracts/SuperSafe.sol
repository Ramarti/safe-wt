// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { TokenLib } from "./token/TokenLib.sol";
import { InputSanitizer } from "./utils/InputSanitizer.sol";

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import "hardhat/console.sol";

contract SuperSafe is InputSanitizer, ReentrancyGuard, Ownable2Step {
    /*
    using TokenLib for TokenLib.Token;
    using Address for address payable;

    event DepositReceived(TokenLib.Token indexed token, address indexed depositor, uint256 amount);
    event WithdrawalExecuted(TokenLib.Token indexed token, address indexed depositor, uint256 amount);
    event FeeAccrued(TokenLib.Token indexed token, uint256 amount);
    event FeeWithdrawalExecuted(TokenLib.Token indexed token, address destination, uint256 amount);

    error NativeDepositUnderfunded();
    error NonNativeDepositMustNotSendNative();
    error NothingToWithdraw();

    struct SafeEntry {
        uint256 deposit;
        uint256 accruedFee;
        uint256 checkPoint;
    }

    uint256 public constant SCALE_RESOLUTION = 1*10**18;
    uint256 private constant SECONDS_IN_DAY = (24*60*60);
    // 0.005% --> 0.005 / 100 * SCALE_RESOLUTION = 5*10^-5 * 1*10^18
    uint256 public constant FEE_DAILY_SCALED = 5*10**(18-5);
    uint256 public immutable WITHDRAWAL_FEE_PER_SECOND_SCALED;
    
    constructor() Ownable2Step() {
        WITHDRAWAL_FEE_PER_SECOND_SCALED = FEE_DAILY_SCALED / (24*60*60);
    }

    // depositor => token => amount
    mapping(address => mapping(TokenLib.Token => SafeEntry)) private _entries;
    mapping(TokenLib.Token => uint256) private _ownerFees;

    function deposit(TokenLib.Token token, uint256 amount) external nonReentrant nonZeroToken(token) payable {
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
        SafeEntry storage se = _entries[msg.sender][token];
        se.deposit += amount;
        _accrueFee(token, msg.sender, amount);
        emit DepositReceived(token, msg.sender, amount);
    }

    function withdraw(TokenLib.Token token) external nonReentrant {
        uint256 amount = (_entries[msg.sender][token]).deposit;
        if (amount == 0) {
            revert NothingToWithdraw();
        }
        uint256 fee = currentFees(token, msg.sender);
        if (fee > 0) {
            amount -= fee;
            fees[token] += fee;
            emit FeeAccrued(token, fee);
        }
        _entries[msg.sender][token] = SafeEntry({ deposit: 0, checkPoint: 0 });
        token.transfer(msg.sender, amount);
        emit WithdrawalExecuted(token, msg.sender, amount);
    }
    
    /**
     * Method that updates the accrued fees with each deposit, so the owner can 
     * @param token address of the asset deposited
     * @param depositor address depositing
     * @param increment amount being deposited
     */
    /*
    function _accrueFee(TokenLib.Token token, address depositor, uint256 increment) private {
        SafeEntry storage se = _entries[depositor][token];
        uint256 toAccrue = _nonAccruedFees(se);
        se.accruedFee += toAccrue;
        se.checkPoint = block.timestamp;
        _ownerFees[token] += toAccrue;
        emit FeeAccrued(token, toAccrue);
    }*/
    /**
     * Sends all the fees collected for an asset to the specified address.
     * Only callable by contract owner
     * @param token address
     * @param to destination the fees will go to
     */
    /*
    function collectFees(TokenLib.Token token, address to) external nonZeroAddress(to) onlyOwner nonReentrant {
        uint256 amount = _ownerFees[token]; // TODO non accrued
        if (amount == 0) {
            revert NothingToWithdraw();
        }
        _ownerFees[token] = 0;
        token.transfer(to, amount);
        emit FeeWithdrawalExecuted(token, to, amount);
    }

    function depositedFor(address depositor, TokenLib.Token token) external view  returns(uint256) {
        return (_entries[depositor][token]).deposit;
    }

    function _nonAccruedFees(SafeEntry calldata se) private view returns (uint256) {
        
    }
    
    function currentDepositorFees(TokenLib.Token token, address depositor) public view returns(uint256) {
        SafeEntry storage se = _entries[depositor][token];
        return se.accruedFee + _nonAccruedFees(se);
    }
    */
}
