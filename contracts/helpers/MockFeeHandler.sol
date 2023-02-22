// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;
import { FeeHandler } from "../utils/FeeHandler.sol";

contract MockFeeHandler is FeeHandler {
    FeeAccumulator public acc;

    constructor(uint256 __rate, uint256 __resolution) FeeHandler() {
        _setRate(__rate, __resolution);
    }

    function rate() external view returns(uint256, uint256) {
        return (_rate, _resolution);
    }

    function incrementDeposit(uint256 delta) external {
        _incrementDeposit(acc, delta);
    }

    function decrementDeposit(uint256 delta) external {
        _decrementDeposit(acc, delta);
    }

    function currentFee() external view returns (uint256) {
        return _currentFee(acc);
    }
}
