import express, { Express, Request, Response } from "express";
import cors from "cors";

import config from "./config";
import { postPaymentIntent } from "routes/payment-intent";
import { postStripeWebhook } from "routes/stripe-webhook";

const app: Express = express();
app.use(cors());

app.get("/health", (_: Request, res: Response) => {
  res.status(200).send("Service is healthy");
});
app.post("/payment-intent", express.json(), postPaymentIntent);
app.post("/stripe-webhook", express.text({ type: "*/*" }), postStripeWebhook);

app.listen(config.port, () => {
  console.log(
    `⚡️[server]: Server is running at http://localhost:${config.port}`
  );
});
