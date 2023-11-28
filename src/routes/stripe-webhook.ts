import { Request, Response } from "express";
import { execute } from "@mintbase-js/sdk";

import config from "../config";
import { Account } from "near-api-js";
import { calculateCostUsdcents, isMintbaseContractCall } from "common";

export async function postStripeWebhook(req: Request, res: Response) {
  console.log(`Received webhook POST: ${req.body}`);

  const actor = await config.getActorAccount();
  console.log(`Actor account OK`);

  // check signature
  const signature = req.get("stripe-signature");
  if (!signature) {
    const error = "No signature for stripe webhook request";
    console.error(error);
    res.status(401).send({ error });
    return;
  }
  console.log(`Signature verified`);

  const event = config.stripe.webhooks.constructEvent(
    req.body,
    signature,
    config.stripeWebhookSecret
  );
  console.log(`Event constructed`);

  switch (event.type) {
    case "payment_intent.succeeded":
      try {
        await processAction(
          actor,
          event.data.object.metadata.action,
          event.data.object.amount_received
        );
      } catch (e: any) {
        const err = JSON.stringify(e);
        // FIXME: refund user!
        console.error(err);
        res
          .status(500)
          .send(
            `Encountered an error while dispatching the transaction: ${err}`
          );
        return;
      }
      console.log(`Success event processed`);
      break;
    default:
      console.error(`Bad event type: ${event.type}`);
  }

  res.status(200).send();
}

async function processAction(
  actor: Account,
  actionString: string,
  amountReceived: number
) {
  // parse and verify payload
  const action = JSON.parse(actionString);
  if (!isMintbaseContractCall(action))
    throw new Error(`Not a MintbaseContractCall: ${actionString}`);

  // verify that we are not spending more NEAR/USDC than what we got from stripe
  const cost = await calculateCostUsdcents(action);
  if (cost > amountReceived * 0.9) {
    throw new Error(
      "The received is amount is not sufficient to cover the requested action"
    );
  }

  await execute({ account: actor }, action);
}
