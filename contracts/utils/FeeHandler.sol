// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

abstract contract FeeHandler {
    struct FeeAccumulator {
        uint256 checkPoint;
        uint256 deposit;
        uint256 accruedFees;
    }

    uint256 internal _rate;
    uint256 internal _resolution;

    function _setRate(uint256 __rate, uint256 __resolution) internal {
        _rate = __rate;
        _resolution = __resolution;
    }

    function _incrementDeposit(FeeAccumulator storage acc, uint256 delta) internal {
        //console.log("+++++_incrementDeposit before");
        //log(acc);
        _accrueFee(acc);
        acc.deposit += delta;
        //console.log("+++++_incrementDeposit after");
        //log(acc);
    }

    function _decrementDeposit(FeeAccumulator storage acc, uint256 delta) internal {
        _accrueFee(acc);
        acc.deposit -= delta;
        if (acc.deposit == 0) {
            acc.checkPoint = 0;
        }
    }

    function log(FeeAccumulator storage acc) internal view {
        console.log("checkPoint", acc.checkPoint);
        console.log("deposit", acc.deposit);
        console.log("accruedFees", acc.accruedFees);
    }

    function _accrueFee(FeeAccumulator storage acc) internal {
        //console.log("+++++_accrueFee before");
        //log(acc);
        acc.accruedFees += _nonAccruedFees(acc);
        acc.checkPoint = block.timestamp;
        //console.log("+++++_accrueFee after");
        //log(acc);
    }

    function _nonAccruedFees(FeeAccumulator storage acc) internal view returns (uint256) {
        uint256 deltaTime = (acc.checkPoint >= block.timestamp || acc.checkPoint == 0)
            ? 0
            : block.timestamp - acc.checkPoint;
        uint256 feeRate = Math.mulDiv(_rate, deltaTime, 1);
        /*
        console.log('+++++_nonAccruedFees: ');
        

        console.log('deltaTime', deltaTime);
        console.log('feeRate', feeRate);
        console.log('_nonAccruedFees', Math.mulDiv(acc.deposit, feeRate, _resolution));
        */
        return Math.mulDiv(acc.deposit, feeRate, _resolution);
    }

    function _currentFee(FeeAccumulator storage acc) internal view returns (uint256) {
        return acc.accruedFees + _nonAccruedFees(acc);
    }
}
