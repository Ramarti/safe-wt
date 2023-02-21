// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;
import { TokenLib } from "./TokenLib.sol";

abstract contract InputSanitizer {
    using TokenLib for TokenLib.Token;

    error ZeroAddress();

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