import dotenv from "dotenv";
import * as nearAPI from "near-api-js";
import { Account, InMemorySigner, KeyPair } from "near-api-js";
import { InMemoryKeyStore } from "near-api-js/lib/key_stores";
import { JsonRpcProvider } from "near-api-js/lib/providers";
import { mbjs } from "@mintbase-js/sdk";
import Stripe from "stripe";

dotenv.config();

const portEnv = process.env.PORT || "8080";

async function connect(
  accountId: string,
  privateKey: string,
  network: string
): Promise<Account> {
  const keyStore = new InMemoryKeyStore();
  await keyStore.setKey(network, accountId, KeyPair.fromString(privateKey));

  const provider = new JsonRpcProvider({
    url: `https://rpc.${network}.near.org`,
  });

  const signer = new InMemorySigner(keyStore);

  const account = new Account(
    {
      networkId: network,
      provider,
      signer,
      jsvmAccountId: "",
    },
    accountId
  );

  return account;
}

function readEnvVar(name: string): string {
  const envVar = process.env[name];
  if (!envVar) throw new Error(`${name} is not defined`);
  return envVar;
}

export const config = (() => {
  const stripeSecretKey = readEnvVar("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = readEnvVar("STRIPE_WEBHOOK_SECRET");
  const actorAccountId = readEnvVar("ACTOR_ACCOUNT_ID");
  const actorSecretKey = readEnvVar("ACTOR_SECRET_KEY");
  const nearNetwork = readEnvVar("NEAR_NETWORK");

  mbjs.config({ network: nearNetwork });

  return {
    port: parseInt(portEnv),
    stripe: new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" }),
    stripeWebhookSecret,
    getActorAccount: async () =>
      connect(actorAccountId, actorSecretKey, nearNetwork),
    // TODO: can get rid of this if we use mbjs for fetching gas price
    getNearConnector: async () =>
      nearAPI.connect({
        networkId: nearNetwork,
        nodeUrl: `https://rpc.${nearNetwork}.near.org`,
      }),
  };
})();
export default config;
