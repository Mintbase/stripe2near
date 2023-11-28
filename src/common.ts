import BN from "bn.js";
import * as mbjsData from "@mintbase-js/data";

import config from "./config";

// import { ContractCall } from "@mintbase-js/sdk";
export type MintbaseContractCall = {
  contractAddress: string;
  methodName: string;
  args: any;
  gas: string | BN;
  deposit: string | BN;
};

export function isMintbaseContractCall(x: any): x is MintbaseContractCall {
  if (!isObject(x)) return false;
  if (typeof x.contractAddress !== "string") return false;
  if (typeof x.method !== "string") return false;
  if (!isObject(x.args)) return false;
  if (!isStringOrBn(x.gas)) return false;
  if (!isStringOrBn(x.deposit)) return false;
  return true;
}

function isStringOrBn(x: any): x is string | BN {
  if (typeof x === "string") return true;
  if (BN.isBN(x)) return true;
  return false;
}

export function isObject(x: any): x is Object {
  return typeof x === "object" && !Array.isArray(x) && x !== null;
}

function getBn(x: string | BN): BN {
  if (BN.isBN(x)) return x;
  return new BN(x);
}

/// Calculates the cost of a contract call in $USD cents.
export async function calculateCostUsdcents(
  call: MintbaseContractCall,
  nearPrice?: string,
  gasPrice?: string
): Promise<number> {
  const nearCost = await calculateCostNear(call, gasPrice);
  if (!nearPrice) nearPrice = await getNearPrice();
  //

  const cost = nearCost
    .muln(parseFloat(nearPrice as string))
    // div by 1e24 for yoctoNEAR->NEAR, multiply by 100 for USD cents => div by 1e22
    .div(new BN(`1${"0".repeat(22)}`));

  return Math.round(cost.toNumber());
}

/// Calculates cost of a contract call in $NEAR.
async function calculateCostNear(
  call: MintbaseContractCall,
  gasPrice?: string
): Promise<BN> {
  if (!gasPrice) gasPrice = await getGasPrice();

  const deposit = getBn(call.deposit);
  const gasUnconverted = getBn(call.gas);
  const gas = gasUnconverted.mul(new BN(gasPrice)).muln(1.05);

  return deposit.add(gas);
}

async function getNearPrice(): Promise<string> {
  const { data: nearPrice, error } = await mbjsData.nearPrice();
  if (error) throw error;
  return nearPrice as string;
}

async function getGasPrice(): Promise<string> {
  const near = await config.getNearConnector();
  // TODO: replace with mbjs once mbjs is fixed
  const block = await near.connection.provider.block({ finality: "final" });
  return block.header.gas_price;
}
