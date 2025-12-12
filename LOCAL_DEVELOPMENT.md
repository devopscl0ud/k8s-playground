# Local Development Setup

## Quick Local Setup (For Testing)

### Step 1: Start Backend Locally
```bash
cd k8s-playground
npm install
npm run dev
```

### Step 2: Serve Frontend
```bash
# In another terminal
cd k8s-playground
python -m http.server 8000
```

### Step 3: Access Playground
- Frontend: http://localhost:8000
- Backend: http://localhost:3001

## Production Deployment Checklist

### Pre-deployment
- [ ] Backend URL configured in frontend
- [ ] Service account created with proper permissions
- [ ] Docker image built and pushed
- [ ] Cloud Run service deployed
- [ ] Frontend updated with backend URL

### Post-deployment
- [ ] Health check passes
- [ ] Cluster connection works
- [ ] WebSocket connection established
- [ ] All features working
- [ ] Monitoring setup
- [ ] Documentation updated

## Code Download Instructions

### Option 1: ZIP Download
```bash
# Download all files as ZIP
wget -O k8s-playground.zip https://oay657csd5ugc.ok.kimi.link/download
unzip k8s-playground.zip
cd k8s-playground
```

### Option 2: Git Clone (Recommended)
```bash
# If you have a git repository
git clone <your-repo-url> k8s-playground
cd k8s-playground
```

### Option 3: Individual Files
```bash
# Create directory
mkdir k8s-playground
cd k8s-playground

# Download each file
wget https://oay657csd5ugc.ok.kimi.link/index.html
wget https://oay657csd5ugc.ok.kimi.link/tutorials.html
wget https://oay657csd5ugc.ok.kimi.link/reference.html
wget https://oay657csd5ugc.ok.kimi.link/main.js
wget https://oay657csd5ugc.ok.kimi.link/frontend-integration.js
wget https://oay657csd5ugc.ok.kimi.link/server.js
wget https://oay657csd5ugc.ok.kimi.link/package.json
wget https://oay657csd5ugc.ok.kimi.link/Dockerfile
wget https://oay657csd5ugc.ok.kimi.link/.env.example
wget https://oay657csd5ugc.ok.kimi.link/deploy.sh

# Make deploy script executable
chmod +x deploy.sh
```

## Deployment Commands

### One-Command Deployment
```bash
./deploy.sh
```

### Manual Deployment Steps
```bash
# 1. Build Docker image
docker build -t gcr.io/$GOOGLE_CLOUD_PROJECT/k8s-playground-backend:latest .

# 2. Push to Container Registry
docker push gcr.io/$GOOGLE_CLOUD_PROJECT/k8s-playground-backend:latest

# 3. Deploy to Cloud Run
gcloud run deploy k8s-playground-backend \
    --image=gcr.io/$GOOGLE_CLOUD_PROJECT/k8s-playground-backend:latest \
    --platform=managed \
    --region=$GOOGLE_CLOUD_REGION \
    --service-account=k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com \
    --allow-unauthenticated \
    --port=3001 \
    --memory=512Mi \
    --cpu=1000m

# 4. Get service URL
SERVICE_URL=$(gcloud run services describe k8s-playground-backend --region=$GOOGLE_CLOUD_REGION --format="value(status.url)")
echo "Backend URL: $SERVICE_URL"

# 5. Update frontend with backend URL
# Edit index.html and replace backend URL in frontend-integration.js
```

## Testing Commands

### Backend Health Check
```bash
curl $SERVICE_URL/api/health
```

### Cluster Info Check
```bash
curl $SERVICE_URL/api/cluster/info
```

### Nodes List
```bash
curl $SERVICE_URL/api/nodes
```

### Pods List
```bash
curl $SERVICE_URL/api/pods
```

## Environment Variables

### Required
```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1
```

### Optional
```bash
BACKEND_URL=https://your-backend-url.com
FRONTEND_URL=https://your-frontend-url.com
NODE_ENV=production
PORT=3001
```

## Troubleshooting Commands

### Check Service Status
```bash
gcloud run services describe k8s-playground-backend --region=$GOOGLE_CLOUD_REGION
```

### View Logs
```bash
gcloud logging read "resource.type=cloud_run_revision resource.labels.service_name=k8s-playground-backend" --limit=50
```

### Check Permissions
```bash
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"
```

### Test Local Backend
```bash
npm install
npm start
# In another terminal
curl http://localhost:3001/api/health
```

## File Structure
```
k8s-playground/
├── index.html              # Main playground interface
├── tutorials.html          # Interactive tutorials
├── reference.html          # Command reference
├── main.js                 # Core JavaScript functionality
├── frontend-integration.js # Real cluster integration
├── server.js               # Backend API server
├── package.json            # Node.js dependencies
├── Dockerfile              # Container configuration
├── deploy.sh               # Deployment script
├── .env.example           # Environment variables template
├── backend-integration.md  # Backend integration guide
├── SETUP_GUIDE.md          # Complete setup guide
├── LOCAL_DEVELOPMENT.md    # Local development guide
└── resources/              # Images and assets
    ├── hero-kubernetes.png
    ├── k8s-architecture-diagram.png
    ├── pod-lifecycle-states.png
    ├── service-types-diagram.png
    └── rolling-deployment-visual.png
```

## Support

For issues or questions:
1. Check the troubleshooting section in SETUP_GUIDE.md
2. Review logs in Google Cloud Console
3. Test with local development setup first
4. Contact support with deployment summary