#!/usr/bin/env bash
# ==============================================================================
# DevFestVerse - Google Cloud Run Deployment Script
# Scaling Policy: Min instances = 0 (scale to zero), Max instances = 1
# ==============================================================================

set -euo pipefail

# 1. Resolve GCP Project ID
PROJECT_ID="${GCP_PROJECT:-${CLOUDSDK_CORE_PROJECT:-${PROJECT_ID:-}}}"

if [ -z "${PROJECT_ID}" ]; then
    # Attempt to retrieve current project from gcloud configuration
    CURRENT_GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
    if [ "${CURRENT_GCLOUD_PROJECT}" = "(unset)" ]; then
        CURRENT_GCLOUD_PROJECT=""
    fi

    if [ -t 0 ]; then
        # Interactive shell prompt
        if [ -n "${CURRENT_GCLOUD_PROJECT}" ]; then
            read -rp "Enter your Google Cloud Project ID [default: ${CURRENT_GCLOUD_PROJECT}]: " USER_INPUT
            PROJECT_ID="${USER_INPUT:-${CURRENT_GCLOUD_PROJECT}}"
        else
            read -rp "Enter your Google Cloud Project ID: " USER_INPUT
            PROJECT_ID="${USER_INPUT}"
        fi
    else
        # Non-interactive fallback
        PROJECT_ID="${CURRENT_GCLOUD_PROJECT}"
    fi
fi

if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" = "(unset)" ]; then
    echo "❌ Error: Google Cloud Project ID is required."
    echo "Please provide it via the GCP_PROJECT environment variable or set your active gcloud project."
    echo ""
    echo "Examples:"
    echo "  GCP_PROJECT=your-gcp-project-id ./deploy.sh"
    echo "  gcloud config set project your-gcp-project-id && ./deploy.sh"
    exit 1
fi

# Configuration Variables
SERVICE_NAME="${CLOUD_RUN_SERVICE:-devfestverse}"
REGION="${GCP_REGION:-asia-southeast3}"
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
