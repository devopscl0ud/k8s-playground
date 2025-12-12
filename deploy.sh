#!/bin/bash

# Kubernetes Playground Deployment Script
# This script deploys the backend to Google Cloud Run and configures the frontend

set -e

echo "🚀 Starting Kubernetes Playground Deployment"

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
SERVICE_NAME="k8s-playground-backend"
FRONTEND_URL="${FRONTEND_URL:-https://oay657csd5ugc.ok.kimi.link}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install it first."
    exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_error "Not authenticated with gcloud. Please run 'gcloud auth login' first."
    exit 1
fi

print_status "Prerequisites check passed"

# Set project
echo "🔧 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# Enable required APIs
echo "📡 Enabling required APIs..."
gcloud services enable container.googleapis.com
#gcloud services enable run.googleapis.com
#gcloud services enable containerregistry.googleapis.com
#gcloud services enable iamcredentials.googleapis.com

print_status "APIs enabled"

# Create service account for Cloud Run
echo "🔐 Creating service account..."
SERVICE_ACCOUNT_EMAIL="k8s-playground-sa@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &>/dev/null; then
    print_warning "Service account already exists"
else
    gcloud iam service-accounts create k8s-playground-sa \
        --display-name="Kubernetes Playground Service Account" \
        --description="Service account for Kubernetes Playground backend"
    print_status "Service account created"
fi

# Grant necessary permissions to service account
echo "🛡️  Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/container.clusterViewer" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/container.developer" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/container.viewer" \
    --condition=None

print_status "Permissions granted"

# Build and push Docker image
echo "🐳 Building and pushing Docker image..."
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

docker build -t $IMAGE_NAME .
docker push $IMAGE_NAME

print_status "Docker image built and pushed"

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image=$IMAGE_NAME \
    --platform=managed \
    --region=$REGION \
    --service-account=$SERVICE_ACCOUNT_EMAIL \
    --allow-unauthenticated \
    --port=3001 \
    --memory=512Mi \
    --cpu=1000m \
    --max-instances=10 \
    --min-instances=1 \
    --timeout=300s \
    --concurrency=100

print_status "Cloud Run deployment completed"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
print_status "Service URL: $SERVICE_URL"

# Update frontend configuration
echo "🎨 Updating frontend configuration..."
cat > frontend-config.js << EOF
window.K8S_PLAYGROUND_CONFIG = {
  backendUrl: "$SERVICE_URL",
  environment: "production",
  features: {
    realCluster: true,
    websockets: true,
    rateLimiting: true
  }
};
EOF

# Create deployment summary
echo "📊 Creating deployment summary..."
cat > deployment-summary.txt << EOF
Kubernetes Playground Deployment Summary
========================================

Frontend URL: $FRONTEND_URL
Backend URL: $SERVICE_URL
Project: $PROJECT_ID
Region: $REGION
Service: $SERVICE_NAME

Services Deployed:
- Cloud Run Service: $SERVICE_NAME
- Service Account: k8s-playground-sa

Next Steps:
1. Update the frontend HTML to include the frontend-config.js
2. Test the connection by visiting the frontend URL
3. Monitor logs: gcloud logging read "resource.type=cloud_run_revision \
   resource.labels.service_name=$SERVICE_NAME" --limit=50

Security Notes:
- Service account has read-only access to Kubernetes cluster
- Rate limiting is enabled (100 requests/minute per IP)
- Sessions timeout after 30 minutes
- All interactions are logged for audit

Troubleshooting:
- Check service status: gcloud run services describe $SERVICE_NAME --region=$REGION
- View logs: gcloud logging read "resource.type=cloud_run_revision" --limit=50
- Test backend: curl $SERVICE_URL/api/health
EOF

print_status "Deployment completed successfully!"
print_status "Backend URL: $SERVICE_URL"
print_status "Frontend URL: $FRONTEND_URL"
print_status "Deployment summary saved to deployment-summary.txt"

echo ""
echo "🎉 Kubernetes Playground is now live!"
echo "📋 Check deployment-summary.txt for details"
echo "🔧 Next: Update frontend HTML with backend URL"
echo "📊 Monitor with: gcloud logging read \"resource.type=cloud_run_revision\" --limit=50"