// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { TokenLib } from "./token/TokenLib.sol";
import { InputSanitizer } from "./utils/InputSanitizer.sol";

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import "hardhat/console.sol";

contract SuperSafe is InputSanitizer, ReentrancyGuard {
    
    using TokenLib for TokenLib.Token;
    using Address for address payable;

    event DepositReceived(TokenLib.Token indexed token, address indexed depositor, uint256 amount);
    event WithdrawalExecuted(TokenLib.Token indexed token, address indexed depositor, uint256 amount);

    error NativeDepositUnderfunded();
    error NonNativeDepositMustNotSendNative();
    error NothingToWithdraw();

    uint256 public constant SCALE_RESOLUTION = 1*10**18;
    uint256 private constant SECONDS_IN_DAY = (24*60*60);
    // 0.005% --> 0.005 / 100 * SCALE_RESOLUTION = 5*10^-5 * 1*10^18
    uint256 public constant FEE_DAILY_SCALED = 5*10**(18-5);

    uint256 public immutable WITHDRAWAL_FEE_PER_SECOND_SCALED;

    struct SafeEntry {
        uint256 deposit;
        uint256 checkPoint;
    }

    constructor() {
        WITHDRAWAL_FEE_PER_SECOND_SCALED = FEE_DAILY_SCALED / (24*60*60);
    }

    // depositor => token => amount
    mapping(address => mapping(TokenLib.Token => SafeEntry)) public entries;

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
        SafeEntry storage se = entries[msg.sender][token];
        se.deposit += amount;
        se.checkPoint = block.timestamp;
        emit DepositReceived(token, msg.sender, amount);
    }

    function withdraw(TokenLib.Token token) external nonReentrant {
        uint256 amount = (entries[msg.sender][token]).deposit;
        if (amount == 0) {
            revert NothingToWithdraw();
        }
        entries[msg.sender][token] = SafeEntry({ deposit: 0, checkPoint: 0 });
        token.transfer(msg.sender, amount);
        emit WithdrawalExecuted(token, msg.sender, amount);
    }

    function depositFor(address depositor, TokenLib.Token token) external view  returns(uint256) {
        return (entries[depositor][token]).deposit;
    }
    /*
    function currentFees(TokenLib.Token token, address depositor) public view returns(uint256) {
        SafeEntry storage se = entries[depositor][token];
        
        return Math.mulDiv(se.deposit, WITHDRAWAL_FEE_PPM, PPM_RESOLUTION);
    }
    */
}
