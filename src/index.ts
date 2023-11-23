import express, { Express, Request, Response } from "express";
import { createHash } from "crypto";
import cors from "cors";
import { execute } from "@mintbase-js/sdk";

import config from "./config";

const app: Express = express();
app.use(cors());

app.get("/health", (_: Request, res: Response) => {
  res.status(200).send("Service is healthy");
});

app.post(
  "/payment-intent",
  express.json(),
  async (req: Request, res: Response) => {
    console.log(
      `Request for payment intent creation posted: ${JSON.stringify(req.body)}`
    );
    const { priceUsd, action } = req.body;
    // TODO: validate priceUsd!
    // TODO: validate action!
    const description = createHash("sha256")
      .update(priceUsd.toString())
      .update(JSON.stringify(action))
      .digest("base64");
    console.log(`Created description: ${description}`);
    // FIXME: verify that we are not spending more NEAR/USDC than we charge via
    // Stripe

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
);

app.post(
  "/stripe-webhook",
  express.text({ type: "*/*" }),
  async (req: Request, res: Response) => {
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
        console.log(`Success event processed`);
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
