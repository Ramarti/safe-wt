# SuperSafe test

Write a digital safe:

It holds any erc20 token for a daily fee of 0.005%, the owner of the contract can transfer the collected fees to any address.

- [x] includes a deposit function - supports eth and any erc20 token

- [x] includes a withdraw function

- [x] includes a collectFees function, only accessible to the owner of the contracts, transfers the collected fees to a specified address

- [x] contract should be secured, safe from the common pitfalls such as a reentry attack.

- [x] contract should have 100% test coverage

- [x] You should deploy the contract to a tenderly fork

- [ ] bonus points: write a simple script that interacts with the fork and performs deposits/withdrawals/collection.


## Install
```shell
yarn
```

## Environment

You need to create a .env file.
Fill the values in .env.example and execute
```shell
cp .env.example .env
```

## Run tests
```shell
yarn test
```

## Run tests coverage
```shell
yarn test
```

## Deploy to Goerli
```shell
npx hardhat --network goerli run scripts/deploy.js 
```

## Deploy to Tenderly fork
```shell
npx hardhat --network tendely run scripts/deploy.js 
```
