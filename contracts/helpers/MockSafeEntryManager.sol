// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;
import { SafeEntryManager } from "../utils/SafeEntryManager.sol";

contract MockSafeEntryManager is SafeEntryManager {
    SafeEntry public acc;

    constructor(uint256 __rate, uint256 __resolution) SafeEntryManager(__rate, __resolution) {}

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
