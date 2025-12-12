# Kubernetes Playground - Backend Integration Guide

## Architecture Overview

```
Frontend (Playground Web App) ↔ Backend API ↔ Your Real Kubernetes Cluster
```

## Required Components

### 1. Backend API Server
- Node.js/Express server with Kubernetes client
- WebSocket support for real-time updates
- Authentication and rate limiting

### 2. Kubernetes Integration
- Service account with minimal permissions
- Read-only access for safety
- Resource quotas and limits

### 3. Google Cloud Integration
- Cloud Run or GKE for backend hosting
- Cloud SQL for user data (optional)
- Cloud Storage for configurations

## Implementation Steps

### Step 1: Create Backend API
```bash
mkdir k8s-playground-backend
cd k8s-playground-backend
npm init -y
npm install express socket.io @kubernetes/client-node cors dotenv
```

### Step 2: Kubernetes Service Account
```bash
# Create service account for playground
kubectl create serviceaccount k8s-playground-sa
kubectl create clusterrole k8s-playground-role \
  --verb=get,list,watch \
  --resource=pods,services,deployments,nodes
kubectl create clusterrolebinding k8s-playground-binding \
  --clusterrole=k8s-playground-role \
  --serviceaccount=default:k8s-playground-sa
```

### Step 3: Environment Configuration
```bash
# .env file
KUBECONFIG=/path/to/your/kubeconfig
PORT=3001
CLUSTER_ENDPOINT=your-cluster-endpoint
GOOGLE_CLOUD_PROJECT=your-project-id
```

## Security Considerations

1. **Read-Only Access**: Users can only view resources, not modify
2. **Resource Limits**: Maximum 10 pods per user session
3. **Timeout**: Sessions auto-expire after 30 minutes
4. **Audit Logging**: All interactions logged
5. **Rate Limiting**: Max 100 requests per minute per user

## Deployment Options

### Option A: Cloud Run (Recommended for minimal setup)
- Serverless, auto-scaling
- Pay-per-use pricing
- Easy deployment

### Option B: GKE Autopilot
- Dedicated Kubernetes cluster
- More control over resources
- Higher cost but better isolation

### Option C: Self-hosted VM
- Full control
- Manual scaling required
- Cost-effective for development
```