# Kubernetes Playground - Complete Setup Guide

## 🎯 Goal
Deploy a production-ready Kubernetes Playground that connects to your real cluster, allowing users to interact with live Kubernetes resources through a web interface.

## 📋 Prerequisites

### Required Tools
- [ ] Google Cloud SDK (`gcloud`)
- [ ] Docker
- [ ] Git
- [ ] Node.js 18+ (for local development)
- [ ] kubectl configured with your cluster access

### Required Access
- [ ] Google Cloud Project with billing enabled
- [ ] Kubernetes cluster (GKE recommended) with at least 1 CPU and 5GB RAM
- [ ] Service account with Kubernetes cluster access

## 🚀 Quick Start (5 minutes)

### Step 1: Configure Environment
```bash
# Set your project ID
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_REGION=us-central1

# Clone the playground code
git clone <repository-url> k8s-playground
cd k8s-playground
```

### Step 2: One-Command Deployment
```bash
# Make deploy script executable and run
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Test the Deployment
```bash
# Get your backend URL
SERVICE_URL=$(gcloud run services describe k8s-playground-backend --region=$GOOGLE_CLOUD_REGION --format="value(status.url)")

# Test backend health
curl $SERVICE_URL/api/health

# Test cluster connection
curl $SERVICE_URL/api/cluster/info
```

## 🔧 Manual Setup (Detailed)

### Phase 1: Google Cloud Setup (10 minutes)

1. **Set up Google Cloud Project**
```bash
# Login to gcloud
gcloud auth login

# Set project
gcloud config set project $GOOGLE_CLOUD_PROJECT
gcloud config set run/region $GOOGLE_CLOUD_REGION

# Enable required APIs
gcloud services enable container.googleapis.com
#gcloud services enable run.googleapis.com
#gcloud services enable containerregistry.googleapis.com
```

2. **Create Service Account**
```bash
# Create service account
gcloud iam service-accounts create k8s-playground-sa \
    --display-name="Kubernetes Playground Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
    --member="serviceAccount:k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
    --role="roles/container.clusterViewer"

gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
    --member="serviceAccount:k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
    --role="roles/container.viewer"
```

### Phase 2: Backend Deployment (15 minutes)

1. **Build Docker Image**
```bash
# Build and push to Google Container Registry
docker build -t gcr.io/$GOOGLE_CLOUD_PROJECT/k8s-playground-backend:latest .
docker push gcr.io/$GOOGLE_CLOUD_PROJECT/k8s-playground-backend:latest
```

2. **Deploy to Cloud Run**
```bash
# Deploy the service
gcloud run deploy k8s-playground-backend \
    --image=gcr.io/$GOOGLE_CLOUD_PROJECT/k8s-playground-backend:latest \
    --platform=managed \
    --region=$GOOGLE_CLOUD_REGION \
    --service-account=k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com \
    --allow-unauthenticated \
    --port=3001 \
    --memory=512Mi \
    --cpu=1000m \
    --max-instances=10 \
    --min-instances=1
```

### Phase 3: Frontend Integration (5 minutes)

1. **Get Backend URL**
```bash
SERVICE_URL=$(gcloud run services describe k8s-playground-backend --region=$GOOGLE_CLOUD_REGION --format="value(status.url)")
echo "Backend URL: $SERVICE_URL"
```

2. **Update Frontend Configuration**
```javascript
// Add this to your frontend HTML
window.K8S_PLAYGROUND_CONFIG = {
  backendUrl: "YOUR_SERVICE_URL",
  environment: "production",
  features: {
    realCluster: true,
    websockets: true,
    rateLimiting: true
  }
};
```

## 📊 Verification Steps

### 1. Check Backend Health
```bash
curl $SERVICE_URL/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-12T12:00:00.000Z"
}
```

### 2. Check Cluster Connection
```bash
curl $SERVICE_URL/api/cluster/info
```

**Expected Response:**
```json
{
  "nodes": 3,
  "pods": 25,
  "services": 8,
  "deployments": 5,
  "timestamp": "2025-12-12T12:00:00.000Z"
}
```

### 3. Test WebSocket Connection
Open browser console and check:
```javascript
// Should show WebSocket connection established
console.log(window.k8sRealCluster.getConnectionStatus());
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. Backend Connection Failed
**Symptoms:** Frontend shows "Demo Mode" or connection errors

**Solutions:**
```bash
# Check if backend is running
gcloud run services describe k8s-playground-backend --region=$GOOGLE_CLOUD_REGION

# Check backend logs
gcloud logging read "resource.type=cloud_run_revision resource.labels.service_name=k8s-playground-backend" --limit=50

# Test backend directly
curl $SERVICE_URL/api/health
```

#### 2. Kubernetes API Access Denied
**Symptoms:** Backend logs show permission errors

**Solutions:**
```bash
# Check service account permissions
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"

# Add missing permissions
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
    --member="serviceAccount:k8s-playground-sa@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
    --role="roles/container.viewer"
```

#### 3. WebSocket Connection Issues
**Symptoms:** Real-time updates not working

**Solutions:**
```bash
# Check Cloud Run configuration
gcloud run services describe k8s-playground-backend --region=$GOOGLE_CLOUD_REGION

# WebSocket should be supported by default in Cloud Run
# If issues persist, check frontend CORS configuration
```

#### 4. High Memory Usage
**Symptoms:** Backend crashes or slow response

**Solutions:**
```bash
# Increase memory allocation
gcloud run services update k8s-playground-backend \
    --region=$GOOGLE_CLOUD_REGION \
    --memory=1Gi
```

## 🎮 Usage Guide

### For Users
1. **Access the Playground:** Open the frontend URL in browser
2. **Start Simulation:** Click "Start Cluster Simulation"
3. **Interact with Real Cluster:** All operations now show real cluster data
4. **Explore Resources:** Use the left panel to navigate different resources

### For Administrators
1. **Monitor Usage:** Check Cloud Run metrics in Google Cloud Console
2. **View Logs:** Use Cloud Logging to track all interactions
3. **Scale Resources:** Adjust Cloud Run instance count based on usage
4. **Security:** Review audit logs for any suspicious activity

## 📈 Monitoring and Scaling

### Monitoring Commands
```bash
# View Cloud Run metrics
gcloud monitoring dashboards create --config-from-file=monitoring-dashboard.yaml

# Check error rates
gcloud logging read "resource.type=cloud_run_revision severity>=ERROR" --limit=10

# Monitor WebSocket connections
gcloud logging read "resource.type=cloud_run_revision textPayload:websocket" --limit=20
```

### Scaling Configuration
```bash
# Increase max instances for high traffic
gcloud run services update k8s-playground-backend \
    --region=$GOOGLE_CLOUD_REGION \
    --max-instances=20

# Adjust CPU and memory
gcloud run services update k8s-playground-backend \
    --region=$GOOGLE_CLOUD_REGION \
    --cpu=2000m \
    --memory=1Gi
```

## 🔒 Security Best Practices

1. **Network Security**
   - Use VPC connector for private clusters
   - Enable Cloud Armor for DDoS protection
   - Configure firewall rules for restricted access

2. **Authentication**
   - Implement user authentication for production
   - Use OAuth 2.0 or Google Sign-In
   - Add session management

3. **Audit Logging**
   - All user interactions are logged
   - Monitor for unusual activity
   - Set up alerts for security events

4. **Resource Limits**
   - Implement pod quotas per user
   - Set resource limits on containers
   - Monitor cluster resource usage

## 🚀 Next Steps

### Immediate Improvements
1. **Add User Authentication:** Implement Google Sign-In or OAuth
2. **Enhanced Monitoring:** Set up alerts and dashboards
3. **User Quotas:** Limit resources per user session
4. **Audit Trail:** Track all user interactions

### Advanced Features
1. **Multi-Cluster Support:** Connect to multiple clusters
2. **Custom Namespaces:** Allow users to create isolated environments
3. **Resource Templates:** Pre-configured application templates
4. **Collaborative Sessions:** Multiple users in same environment

### Performance Optimizations
1. **Caching:** Implement Redis for session storage
2. **CDN:** Use Cloud CDN for static assets
3. **Database:** Add Cloud SQL for user data
4. **Monitoring:** Comprehensive observability setup

## 📚 Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Kubernetes Client Library](https://github.com/kubernetes-client/javascript)
- [Cloud IAM Best Practices](https://cloud.google.com/iam/docs/using-iam-securely)
- [Cloud Monitoring](https://cloud.google.com/monitoring/docs)

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Cloud Run logs in Google Cloud Console
3. Test backend endpoints manually
4. Contact support with deployment summary from `deployment-summary.txt`

---

**Happy Learning! 🎉**