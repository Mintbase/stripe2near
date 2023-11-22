import express, { Express, Request, Response } from "express";
import { createHash } from "crypto";
import { execute } from "@mintbase-js/sdk";

import config from "./config";

const app: Express = express();

app.get("/health", (_: Request, res: Response) => {
  res.status(200);
});

app.post(
  "/payment-intent",
  express.json(),
  async (req: Request, res: Response) => {
    const { priceUsd, action } = req.body;
    // TODO: validate priceUsd!
    // TODO: validate action!
    const description = createHash("sha256")
      .update(priceUsd.toString())
      .update(JSON.stringify(action))
      .digest("base64");

    const paymentIntent = await config.stripe.paymentIntents.create({
      amount: priceUsd,
      currency: "usd",
      description: description,
      payment_method_types: ["card"],
      metadata: { action },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  }
);

app.post(
  "/stripe-webhook",
  express.text(),
  async (req: Request, res: Response) => {
    const actor = await config.getActorAccount();

    // check signature
    const signature = req.get("stripe-signature");
    if (!signature) {
      const error = "No signature for stripe webhook request";
      console.error(error);
      res.status(401).send({ error });
      return;
    }

    const event = config.stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.stripeWebhookSecretKey
    );

    switch (event.type) {
      case "charge.succeeded":
        // FIXME: verify that we are not spending more NEAR/USDC than what we
        // got from stripe
        // TODO: take a cut
        // TODO: verify the payload
        // @ts-ignore
        await execute({ account: actor }, event.data.object.metadata);
        break;
      default:
        console.error(`Bad event type: ${event.type}`);
    }

    res.status(200).send();
  }
);

app.listen(config.port, () => {
  console.log(
    `⚡️[server]: Server is running at http://localhost:${config.port}`
  );
});
