// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;
import { TokenLib } from "../token/TokenLib.sol";

contract MockTokenLib {
    using TokenLib for TokenLib.Token;
    TokenLib.Token public token;

    function noopTransferFrom() external {
        TokenLib.transferFrom(TokenLib.NATIVE_TOKEN, msg.sender, address(this), 123);
    }
}
