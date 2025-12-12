# Real Kubernetes Cluster Integration Guide

## Overview
This guide helps you connect your k8s-playground to your real Kubernetes cluster (3-node setup: 1 master + 2 workers on GCP VMs).

## Your Cluster Details
```
Cluster: k8s-playground (GCP VMs)
Control Plane: k8s-master (Ready)
Worker Nodes: k8s-worker1, k8s-worker2 (Ready)
Kubernetes Version: 1.31.14 - 1.32.10
API Server: https://k8s-master:6443
```

---

## Step 1: Prepare Service Account for Playground Backend

### Option A: Create a Dedicated Service Account (Recommended for Security)

```bash
# 1. Create namespace for playground
kubectl create namespace k8s-playground-backend

# 2. Create service account
kubectl create serviceaccount k8s-playground-admin -n k8s-playground-backend

# 3. Create cluster role binding
kubectl create clusterrolebinding k8s-playground-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=k8s-playground-backend:k8s-playground-admin

# 4. Get the token (for backend authentication)
kubectl get secret -n k8s-playground-backend \
  $(kubectl get secret -n k8s-playground-backend -o jsonpath='{.items[0].metadata.name}') \
  -o jsonpath='{.data.token}' | base64 -d

# 5. Get the CA certificate
kubectl get secret -n k8s-playground-backend \
  $(kubectl get secret -n k8s-playground-backend -o jsonpath='{.items[0].metadata.name}') \
  -o jsonpath='{.data.ca\.crt}' | base64 -d

# 6. Get the API server endpoint
kubectl cluster-info | grep 'Kubernetes master'
```

### Option B: Use Existing kubeconfig (For Your Current User)

```bash
# On your k8s-master VM, get the kubeconfig
cat ~/.kube/config

# Or for the k8sadmin user
sudo cat /root/.kube/config
```

---

## Step 2: Configure Backend Environment Variables

### Create `.env` file in your k8s-playground directory:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Kubernetes Configuration - Choose ONE option:

# Option A: Path to kubeconfig file
KUBECONFIG=/path/to/your/kubeconfig

# Option B: In-cluster configuration (if running inside Kubernetes)
# KUBECONFIG=/var/run/secrets/kubernetes.io/serviceaccount

# Kubernetes API Configuration
KUBE_API_URL=https://k8s-master:6443
KUBE_CONTEXT=kubernetes-admin@kubernetes

# Backend URL
BACKEND_URL=http://localhost:3001

# Security
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
SESSION_TIMEOUT=1800000

# Logging
LOG_LEVEL=info

# Feature Flags
ENABLE_REAL_CLUSTER=true
ENABLE_WEBSOCKET=true
ENABLE_AUDIT_LOG=true
```

---

## Step 3: Copy Kubeconfig to Backend Server

```bash
# On your local machine with kubeconfig access:

# Copy from k8s-master to your local machine
scp k8sadmin@k8s-master:~/.kube/config ./k8s-kubeconfig

# Then to your playground backend location
scp k8s-kubeconfig your-backend-location:/etc/k8s-playground/kubeconfig

# Set proper permissions
chmod 600 /etc/k8s-playground/kubeconfig
```

---

## Step 4: Update Backend Server Connection (server.js Enhancement)

The backend needs to be enhanced to:
- Support multiple kubeconfig loading methods
- Add cluster health checks
- Add better error handling
- Support cluster connection details exposure

See `ENHANCED_SERVER_SETUP.md` for implementation details.

---

## Step 5: Test Backend Connection

```bash
# Test backend health
curl http://localhost:3001/api/health

# Test cluster info
curl http://localhost:3001/api/cluster/info

# Test nodes endpoint
curl http://localhost:3001/api/nodes

# Test with authentication header (if needed)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/cluster/info
```

---

## Step 6: Update Frontend Configuration

Update your `frontend-integration.js` to connect to your backend:

```javascript
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
const clusterIntegration = new K8sRealClusterIntegration(backendUrl);
```

---

## Step 7: Deploy to Production

### Option A: Deploy Backend on GCP VM

```bash
# SSH into your backend VM
ssh user@your-backend-vm

# Clone/deploy your code
cd /opt/k8s-playground
git clone <your-repo> .

# Install dependencies
npm ci

# Create .env file with values from Step 2
nano .env

# Install PM2 for process management
npm install -g pm2

# Start the application
pm2 start server.js --name "k8s-playground-backend"
pm2 save
pm2 startup

# Check status
pm2 logs k8s-playground-backend
```

### Option B: Deploy Backend in Kubernetes

See `KUBERNETES_DEPLOYMENT.yaml` for Helm chart and K8s manifests.

---

## Step 8: Security Considerations

### Network Security
- [ ] Restrict API server access by IP whitelist
- [ ] Use VPC/private networks for cluster communication
- [ ] Enable TLS for all connections
- [ ] Use strong authentication

### RBAC Configuration
```bash
# Create a read-only service account for users
kubectl create serviceaccount k8s-playground-viewer -n default
kubectl create clusterrole k8s-playground-viewer --verb=get,list,watch --resource=pods,services,deployments
kubectl create clusterrolebinding k8s-playground-viewer \
  --clusterrole=k8s-playground-viewer \
  --serviceaccount=default:k8s-playground-viewer
```

### Secrets Management
- [ ] Don't commit kubeconfig to git
- [ ] Use environment variables for sensitive data
- [ ] Rotate service account tokens regularly
- [ ] Use separate service accounts per environment

---

## Step 9: Monitoring & Health Checks

Add these monitoring endpoints:

```bash
# Cluster health endpoint
curl http://localhost:3001/api/health/cluster

# Node status endpoint
curl http://localhost:3001/api/health/nodes

# API connectivity test
curl http://localhost:3001/api/health/connectivity
```

---

## Troubleshooting

### Connection Issues
```bash
# Test connectivity from backend to API server
curl -k https://k8s-master:6443/api/v1

# Check kubeconfig validity
kubectl config view --kubeconfig=/path/to/kubeconfig

# Test authentication
kubectl auth can-i get pods --as=system:serviceaccount:k8s-playground-backend:k8s-playground-admin
```

### Certificate Issues
```bash
# If using self-signed certs, might need to skip verification
# Add to backend: process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
# (Only for development, not production)
```

### WebSocket Connection
- [ ] Check CORS settings in backend
- [ ] Verify firewall allows WebSocket connections
- [ ] Check Socket.IO version compatibility

---

## Next Steps

1. ✅ Set up service account on cluster
2. ✅ Configure backend environment
3. ✅ Deploy backend
4. ✅ Test all endpoints
5. ✅ Update frontend to use backend
6. ✅ Monitor and secure

See related files:
- [ENHANCED_SERVER_SETUP.md](ENHANCED_SERVER_SETUP.md) - Updated backend code
- [KUBERNETES_DEPLOYMENT.yaml](KUBERNETES_DEPLOYMENT.yaml) - K8s deployment manifests
- [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) - Security best practices
