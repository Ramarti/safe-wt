// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

library TokenLib {
    type Token is address;
    using SafeERC20 for IERC20;
    using Address for address payable;

    address private constant NATIVE_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    Token public constant NATIVE_TOKEN = Token.wrap(NATIVE_TOKEN_ADDRESS);
    uint8 public constant NATIVE_TOKEN_DECIMALS = 18;

    modifier noopForNative(Token token) {
        if (TokenLib.isNative(token)) {
            return;
        }
        _;
    }

    function isNative(Token token) internal pure returns (bool) {
        return Token.unwrap(token) == NATIVE_TOKEN_ADDRESS;
    }

    function toIERC20(Token token) internal pure returns(IERC20) {
        return IERC20(Token.unwrap(token));
    }

    function transferFrom(
        Token token,
        address from,
        address to,
        uint256 amount
    ) internal noopForNative(token) {
        SafeERC20.safeTransferFrom(toIERC20(token), from, to, amount);
    }

    function transfer(Token token, address to, uint256 amount) internal {
        if (TokenLib.isNative(token)) {
            payable(to).sendValue(amount);
        } else {
            SafeERC20.safeTransfer(toIERC20(token), to, amount);
        }
    }
}
