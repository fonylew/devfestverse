#!/usr/bin/env bash
# ==============================================================================
# DevFest Bangkok 2026 — Zero-Trust Ticket Service Cloud Run Deployment
# ==============================================================================
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-gdg-cloud-bangkok-2026}"
REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-devfest-ticket-service}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://gdgcloudbkk.space}"

if [ -z "${GOOGLE_CLIENT_ID:-}" ]; then
  echo "❌ Error: GOOGLE_CLIENT_ID environment variable is required."
  echo "Usage: GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com RECAPTCHA_SECRET_KEY=xxx STAFF_EMAILS=you@gmail.com ./deploy.sh"
  exit 1
fi

echo "🔧 Setting active GCP project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}"

echo "🔌 Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com

# 1. Create or reuse TICKET_HMAC_SECRET in Secret Manager
if ! gcloud secrets describe TICKET_HMAC_SECRET --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "🔐 Generating 256-bit TICKET_HMAC_SECRET in Google Cloud Secret Manager..."
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create TICKET_HMAC_SECRET \
    --replication-policy="automatic" \
    --data-file=-
else
  echo "✅ TICKET_HMAC_SECRET already exists in Secret Manager."
fi

# 2. Create or update RECAPTCHA_SECRET_KEY in Secret Manager if provided
if [ -n "${RECAPTCHA_SECRET_KEY:-}" ]; then
  if ! gcloud secrets describe RECAPTCHA_SECRET_KEY --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "🔐 Creating RECAPTCHA_SECRET_KEY in Secret Manager..."
    printf "%s" "${RECAPTCHA_SECRET_KEY}" | gcloud secrets create RECAPTCHA_SECRET_KEY \
      --replication-policy="automatic" \
      --data-file=-
  else
    echo "🔄 Adding new version to RECAPTCHA_SECRET_KEY in Secret Manager..."
    printf "%s" "${RECAPTCHA_SECRET_KEY}" | gcloud secrets versions add RECAPTCHA_SECRET_KEY --data-file=-
  fi
fi

# 3. Deploy to Cloud Run from source/Dockerfile with max-instances=1
echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run (${REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --platform managed \
  --min-instances 0 \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 30 \
  --allow-unauthenticated \
  --set-env-vars "^@^GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}@ALLOWED_ORIGINS=${ALLOWED_ORIGINS}@STAFF_EMAILS=${STAFF_EMAILS:-}" \
  --set-secrets "TICKET_HMAC_SECRET=TICKET_HMAC_SECRET:latest,RECAPTCHA_SECRET_KEY=RECAPTCHA_SECRET_KEY:latest"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo ""
echo "============================================================"
echo "🎉 Ticket Service Deployed!"
echo "🌐 Endpoint URL: ${SERVICE_URL}"
echo "👉 Update TICKET_API_URL in dev.html & checkin.html to: ${SERVICE_URL}"
echo "============================================================"
