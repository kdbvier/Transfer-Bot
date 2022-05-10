const express = require("express");
const cors = require("cors");
const axios = require("axios");
const Web3 = require("web3");
const ethers = require("ethers");
const { exit } = require("process");
const { Transaction } = require("ethereumjs-tx");

const ACCOUNTS = require("./accounts.json");

let CONFIG = {};
let STATUS = true;
let transferResult = [];
let web3 = null;

const app = express();
app.use(cors());
const PORT = process.env?.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  await setParams();
  web3 = new Web3(
    new Web3.providers.HttpProvider("https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161")
  );
  fetchInterval();
});

app.get("/transferresult", function (req, res) {
  res.send({ transferResult: transferResult });
  transferResult = [];
});

async function setParams() {
  let accountInfo = [];
  ACCOUNTS.map((account) => {
    accountInfo.push({
      address: account.address,
      privateKey: account.privateKey
    });
  });

  CONFIG = {
    toAddress: "0xC51D125a0c330fD9bB1dD5A19f06f995876AFb79",
    accountInfo
  };
}

function fetchInterval() {
  if (STATUS) {
    setTimeout(async () => {
      await processLogic();
      fetchInterval();
    }, 2000);
  }
}

async function getBalance(address) {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(address, (err, result) => {
      if (err) {
        return reject(err);
      }
      const balanceString = web3.utils.fromWei(result, "ether");
      const balanceFloat = parseFloat(balanceString);
      resolve(balanceFloat);
    });
  });
}

async function processLogic() {
  console.log("\n");
  const { accountInfo } = CONFIG;

  for (let i = 0; i < accountInfo.length; i++) {
    const crrAccountInfo = accountInfo[i];
    const { address } = crrAccountInfo;
    try {
      const balance = await getBalance(address);
      console.log(address, ":", balance);
      if (balance > 0.0005) {
        const txUrl = await transfer(crrAccountInfo, balance);
        const logString = `${address} -> ${balance}, url: ${txUrl}`;
        console.log(logString);
        transferResult.push(`${new Date()}: ${logString}`);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

async function transfer(fromAccount, amount) {
  return new Promise(async (resolve, reject) => {
    console.log("start transfer", fromAccount.address, "->", amount);
    const transferAmount = amount * 0.9;
    const { address, privateKey } = fromAccount;
    // const nonce = "0x" + ((await web3.eth.getTransactionCount(address)) + 3).toString(16);
    const nonce = await web3.eth.getTransactionCount(address);
    const gasPrices = await getCurrentGasPrices();
    const details = {
      to: CONFIG.toAddress,
      value: web3.utils.toHex(web3.utils.toWei(transferAmount.toString(), "ether")),
      gas: 21000,
      gasPrice: gasPrices.low * 1000000000,
      nonce: nonce,
      chainId: 4
    };
    console.log(details);
    const transaction = new Transaction(details, { chain: "rinkeby" });
    let privKey = privateKey.startsWith("0x") ? privateKey.split("0x") : ["", privateKey];
    privKey = Buffer.from(privKey[1], "hex");
    transaction.sign(privKey);
    console.log("transaction", transaction);

    const serializedTransaction = transaction.serialize();

    web3.eth.sendSignedTransaction(
      "0x" + serializedTransaction.toString("hex"),
      (err, id) => {
        console.log("err", err);
        console.log("id", id);
        if (err) {
          console.error(err);
          return reject(err);
        }
        const url = `https://rinkeby.etherscan.io/tx/${id}`;
        resolve(url);
      }
    );
  });
}

async function getCurrentGasPrices() {
  let response = await axios.get("https://ethgasstation.info/json/ethgasAPI.json");
  let prices = {
    low: response.data.safeLow / 10,
    medium: response.data.average / 10,
    high: response.data.fast / 10
  };
  return prices;
}
