import { Request, Response } from "express";
import { execute } from "@mintbase-js/sdk";

import config from "../config";

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
    // case "charge.succeeded":
    case "payment_intent.succeeded":
      // FIXME: verify that we are not spending more NEAR/USDC than what we
      // got from stripe
      // TODO: take a cut
      // TODO: verify the payload
      // @ts-ignore
      await execute(
        { account: actor },
        JSON.parse(event.data.object.metadata.action)
      );
      // FIXME: user refund if this fails!
      console.log(`Success event processed`);
      break;
    default:
      console.error(`Bad event type: ${event.type}`);
  }

  res.status(200).send();
}
