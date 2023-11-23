#!/usr/bin/env bash

TAG=gcr.io/omni-cloud-1/stripe2near:latest
docker build . -t "$TAG" || exit 1
docker push "$TAG" || exit 1

source .env

SECRETS='STRIPE_SECRET_KEY=STRIPE2NEAR_STRIPE_SECRET_KEY:latest'
SECRETS+=',STRIPE_WEBHOOK_SECRET=STRIPE2NEAR_STRIPE_WEBHOOK_SECRET:latest'
SECRETS+=',ACTOR_ACCOUNT_ID=STRIPE2NEAR_ACTOR_ACCOUNT_ID:latest'
SECRETS+=',ACTOR_SECRET_KEY=STRIPE2NEAR_ACTOR_SECRET_KEY:latest'

gcloud run deploy "stripe2near" --image "$TAG" \
  --update-env-vars "NEAR_NETWORK=$NEAR_NETWORK" \
  --service-account stripe2near@omni-cloud-1.iam.gserviceaccount.com \
  --update-secrets "$SECRETS" \
  --max-instances 1 \
  --region europe-west1 \
  --allow-unauthenticated
