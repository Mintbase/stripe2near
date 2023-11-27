import { Request, Response } from "express";
import { createHash } from "crypto";

import config from "../config";
import {
  MintbaseContractCall,
  calculateCostUsdcents,
  isMintbaseContractCall,
  isObject,
} from "common";

export async function postPaymentIntent(req: Request, res: Response) {
  console.log(
    `Request for payment intent creation posted: ${JSON.stringify(req.body)}`
  );

  if (!isPostPaymentIntentBody(req.body)) {
    res
      .status(400)
      .send(
        "Post body needs to have an action (mintbase.js/sdk ContractCall) and a priceUsd (number)"
      );
    return;
  }
  const { priceUsd, action } = req.body;

  const description = createHash("sha256")
    .update(priceUsd.toString())
    .update(JSON.stringify(action))
    .digest("base64");
  console.log(`Created description: ${description}`);

  // verify that we are not spending more NEAR/USDC than we charge via Stripe
  const cost = await calculateCostUsdcents(action);
  // TODO: 85% might suggest we are taking a 15% cut, which would be way too high
  // current implementation: Stripe takes ~5%, we take 5%, 5% security margin
  //   for price fluctuations
  // better idea: remove security margin, lower own cut, fix cost calculation
  //   when creating the payment intent and reuse possibly outdated prices when
  //   dispatching
  if (cost > priceUsd * 0.85) {
    res
      .status(400)
      .send("priceUsd * 0.85 must be sufficient to cover transaction costs");
    return;
  }

  const paymentIntent = await config.stripe.paymentIntents.create({
    amount: priceUsd,
    currency: "usd",
    description: description,
    payment_method_types: ["card"],
    metadata: { action: JSON.stringify(action) },
  });
  console.log(`Created payment intent: ${paymentIntent.id}`);

  res.send({ clientSecret: paymentIntent.client_secret });
}

interface PostPaymentIntentBody {
  priceUsd: number;
  action: MintbaseContractCall;
}

function isPostPaymentIntentBody(x: any): x is PostPaymentIntentBody {
  if (!isObject(x)) return false;
  if (typeof x.priceUsd !== "number") return false;
  if (!isMintbaseContractCall(x.action)) return false;
  return true;
}
