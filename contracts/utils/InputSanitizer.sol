// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;
import { TokenLib } from "../token/TokenLib.sol";

abstract contract InputSanitizer {
    using TokenLib for TokenLib.Token;

    error ZeroAddress();
    error ZeroAmount();

    modifier nonZeroAmount(uint256 input) {
        if (input == 0) {
            revert ZeroAmount();
        }
        _;
    }

    modifier nonZeroAddress(address input) {
        if (input == address(0)) {
            revert ZeroAddress();
        }
        _;
    }

    modifier nonZeroToken(TokenLib.Token input) {
        if (TokenLib.Token.unwrap(input) == address(0)) {
            revert ZeroAddress();
        }
        _;
    }
}