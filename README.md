# SuperSafe test

Write a digital safe:

It holds any erc20 token for a daily fee of 0.005%, the owner of the contract can transfer the collected fees to any address.

- [ ] includes a deposit function - supports eth and any erc20 token

- [ ] includes a withdraw function

- [ ] includes a collectFees function, only accessible to the owner of the contracts, transfers the collected fees to a specified address

- [ ] contract should be secured, safe from the common pitfalls such as a reentry attack.

- [ ] contract should have 100% test coverage

- [ ] You should deploy the contract to a tenderly fork

- [ ] bonus points: write a simple script that interacts with the fork and performs deposits/withdrawals/collection.


## Install
```shell
yarn
```

## Run tests
```shell
yarn test
```
