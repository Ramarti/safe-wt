require('dotenv/config');
require('@nomicfoundation/hardhat-toolbox');
require('@nomiclabs/hardhat-solhint');
require('solidity-coverage');
const tdly = require('@tenderly/hardhat-tenderly');
tdly.setup();

module.exports = {
    solidity: {
        compilers: [
            {
                version: '0.8.17',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ],
    },
    networks: {
        goerli: {
            url: process.env.GOERLI_NODE,
            accounts: {
                mnemonic: process.env.GOERLI_MNEMONIC,
            }
        },
        /*tenderly: {
            chainId: 1,
            url: `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`,
            autoImpersonate: true,
            saveDeployments: true,
            live: true
        }*/
    },
    tenderly: {
        forkNetwork: '1',
        project: process.env.TENDERLY_PROJECT,
        username: process.env.TENDERLY_USERNAME
    }
};
