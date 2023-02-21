// SPDX-License-Identifier: GPLv3.0
pragma solidity 0.8.17;
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    
    uint8 private immutable _decimals;

    constructor(string memory __name, string memory __symbol, uint8 __decimals) ERC20(__name, __symbol) {
        _decimals = __decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns(uint8) {
        return _decimals;
    }
}
