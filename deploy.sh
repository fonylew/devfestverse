#!/usr/bin/env bash
# ==============================================================================
# DevFestVerse - Google Cloud Run Deployment Script
# Target GCP Project: gdg-cloud-bangkok-2026
# Scaling Policy: Min instances = 0 (scale to zero), Max instances = 1
# ==============================================================================

set -euo pipefail

# Configuration Variables
PROJECT_ID="${GCP_PROJECT:-gdg-cloud-bangkok-2026}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-devfestverse}"
REGION="${GCP_REGION:-asia-southeast1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "============================================================"
echo "🚀 Deploying DevFestVerse to Google Cloud Run"
echo "============================================================"
echo "📌 Project ID:     ${PROJECT_ID}"
echo "🏢 Service Name:   ${SERVICE_NAME}"
echo "📍 Region:         ${REGION}"
echo "📉 Min Instances:  0 (Scales down to 0 on idle)"
echo "📈 Max Instances:  1 (Single active instance cap)"
echo "============================================================"

# 1. Set Google Cloud Project
echo "🔧 Configuring gcloud active project..."
gcloud config set project "${PROJECT_ID}"

# 2. Enable Required Google Cloud APIs
echo "🔌 Enabling required GCP Services (Cloud Run, Cloud Build, Firestore, Artifact Registry)..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    firestore.googleapis.com \
    artifactregistry.googleapis.com \
    containerregistry.googleapis.com

# 3. Build Container Image with Google Cloud Build
echo "📦 Building container image via Google Cloud Build..."
gcloud builds submit --tag "${IMAGE_NAME}" .

# 4. Deploy to Google Cloud Run with scale-to-zero and max-instances=1
echo "🚀 Deploying service to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --min-instances 0 \
    --max-instances 1 \
    --memory 512Mi \
    --cpu 1 \
    --concurrency 80 \
    --timeout 300 \
    --allow-unauthenticated \
    --set-env-vars "GCP_PROJECT=${PROJECT_ID},PROJECT_NAME=DevFestVerse"

# 5. Output Service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format 'value(status.url)')

echo ""
echo "============================================================"
echo "🎉 Deployment Successful!"
echo "🌐 DevFestVerse Live URL: ${SERVICE_URL}"
echo "============================================================"
