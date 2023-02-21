// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { TokenLib } from "./token/TokenLib.sol";
import { InputSanitizer } from "./utils/InputSanitizer.sol";

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

contract SuperSafe is InputSanitizer, ReentrancyGuard {
    
    using TokenLib for TokenLib.Token;
    using Address for address payable;

    event DepositReceived(TokenLib.Token indexed token, address indexed depositor, uint256 amount);
    event WithdrawalExecuted(TokenLib.Token indexed token, address indexed depositor, uint256 amount);

    error NativeDepositUnderfunded();
    error NonNativeDepositMustNotSendNative();
    error NothingToWithdraw();

    // depositor => token => amount
    mapping(address => mapping(TokenLib.Token => uint256)) public deposits;

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
        deposits[msg.sender][token] = amount;
        emit DepositReceived(token, msg.sender, amount);
    }

    function withdraw(TokenLib.Token token) external nonReentrant {
        uint256 deposited = deposits[msg.sender][token];
        if (deposited == 0) {
            revert NothingToWithdraw();
        }
        deposits[msg.sender][token] = 0;
        token.transfer(msg.sender, deposited);
        emit WithdrawalExecuted(token, msg.sender, deposited);
    }
}
