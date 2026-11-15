require("@nomicfoundation/hardhat-toolbox"); // bundles hardhat-gas-reporter
require("dotenv").config();

const {
  COINMARKETCAP_API_KEY, // optional: converts gas units into USD in the report
  REPORT_GAS,            // set to "true" to print the gas report after `npm test`
} = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    // `npm run node` starts this chain; scripts/deploy.js targets it via --network localhost
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
  },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache", artifacts: "./artifacts" },

  // Gas cost evaluation: run `REPORT_GAS=true npm test` to print a per-function
  gasReporter: {
    enabled: REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY || undefined,
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    token: "ETH",
    outputFile: process.env.CI ? "gas-report.txt" : undefined,
    noColors: Boolean(process.env.CI),
  },
};
