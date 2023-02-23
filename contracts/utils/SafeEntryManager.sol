// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract SafeEntryManager {
    
    struct SafeEntry {
        uint256 checkPoint;
        uint256 deposit;
        uint256 accruedFees;
    }

    uint256 internal _rate;
    uint256 internal _resolution;

    constructor(uint256 __rate, uint256 __resolution) {
        _rate = __rate;
        _resolution = __resolution;
    }

    function rate() public view returns (uint256, uint256) {
        return (_rate, _resolution);
    }

    function _incrementDeposit(SafeEntry storage acc, uint256 delta) internal {
        _accrueFee(acc);
        acc.deposit += delta;
    }

    function _decrementDeposit(SafeEntry storage acc, uint256 delta) internal {
        _accrueFee(acc);
        acc.deposit -= delta;
        if (acc.deposit == 0) {
            acc.checkPoint = 0;
        }
    }

    function _accrueFee(SafeEntry storage acc) internal {
        acc.accruedFees += _nonAccruedFees(acc);
        acc.checkPoint = block.timestamp;
    }

    function _withdrawFee(SafeEntry storage acc, uint256 delta) internal {
        _accrueFee(acc);
        acc.accruedFees -= delta;
    }

    function _nonAccruedFees(SafeEntry storage acc) internal view returns (uint256) {
        uint256 deltaTime = (acc.checkPoint >= block.timestamp || acc.checkPoint == 0)
            ? 0
            : block.timestamp - acc.checkPoint;
        uint256 feeRate = Math.mulDiv(_rate, deltaTime, 1);
        return Math.mulDiv(acc.deposit, feeRate, _resolution);
    }

    function _currentFee(SafeEntry storage acc) internal view returns (uint256) {
        return acc.accruedFees + _nonAccruedFees(acc);
    }
}
