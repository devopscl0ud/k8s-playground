# Real Kubernetes Cluster - Step-by-Step Setup Guide

## Prerequisites

You have:
- ✅ A 3-node Kubernetes cluster (1 control-plane + 2 workers) on GCP VMs
- ✅ Cluster Info: https://k8s-master:6443
- ✅ Kubernetes 1.31.14 - 1.32.10
- ✅ Access to k8s-master as k8sadmin user

---

## PHASE 1: Prepare Your Kubernetes Cluster

### Step 1.1: Create Service Account on Your Cluster

SSH into your k8s-master and run:

```bash
ssh k8sadmin@k8s-master

# Create namespace
kubectl create namespace k8s-playground-backend

# Create service account
kubectl create serviceaccount k8s-playground-admin \
  -n k8s-playground-backend

# Create cluster role binding (admin access for playground)
kubectl create clusterrolebinding k8s-playground-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=k8s-playground-backend:k8s-playground-admin

# Verify
kubectl get serviceaccount -n k8s-playground-backend
kubectl get clusterrolebinding | grep k8s-playground
```

### Step 1.2: Get Service Account Token & Certificate

```bash
# Get the secret name
SECRET_NAME=$(kubectl get secret -n k8s-playground-backend \
  -o jsonpath='{.items[0].metadata.name}')

echo "Secret name: $SECRET_NAME"

# Extract token
kubectl get secret $SECRET_NAME -n k8s-playground-backend \
  -o jsonpath='{.data.token}' | base64 -d > /tmp/k8s-token.txt

# Extract CA certificate
kubectl get secret $SECRET_NAME -n k8s-playground-backend \
  -o jsonpath='{.data.ca\.crt}' | base64 -d > /tmp/k8s-ca.crt

# Show the values (to save them)
echo "=== TOKEN (save this) ==="
cat /tmp/k8s-token.txt
echo -e "\n=== CA CERT (save this) ==="
cat /tmp/k8s-ca.crt
```

### Step 1.3: Create Custom Kubeconfig

Create a file called `kubeconfig-playground` on your k8s-master:

```bash
cat > /tmp/kubeconfig-playground << 'EOF'
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: BASE64_CA_CERT_HERE
    server: https://k8s-master:6443
  name: k8s-playground
contexts:
- context:
    cluster: k8s-playground
    user: k8s-playground-admin
  name: k8s-playground
current-context: k8s-playground
users:
- name: k8s-playground-admin
  user:
    token: TOKEN_HERE
EOF
```

Replace `TOKEN_HERE` and `BASE64_CA_CERT_HERE` with your actual values:

```bash
# Get base64 encoded CA cert
kubectl get secret $SECRET_NAME -n k8s-playground-backend \
  -o jsonpath='{.data.ca\.crt}'

# Get token
kubectl get secret $SECRET_NAME -n k8s-playground-backend \
  -o jsonpath='{.data.token}' | base64 -d
```

### Step 1.4: Verify Kubeconfig Works

```bash
# Test it
KUBECONFIG=/tmp/kubeconfig-playground kubectl cluster-info
KUBECONFIG=/tmp/kubeconfig-playground kubectl get nodes
KUBECONFIG=/tmp/kubeconfig-playground kubectl get pods -A
```

---

## PHASE 2: Deploy Backend Application

### Option A: Deploy on GCP VM (Recommended for Testing)

#### Step 2A.1: Install Node.js and PM2

```bash
# SSH to a backend VM or use k8s-master
ssh root@<backend-vm-ip>

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Verify
node --version
npm --version
```

#### Step 2A.2: Deploy Application

```bash
# Create app directory
mkdir -p /opt/k8s-playground
cd /opt/k8s-playground

# Get your code (via git or manual copy)
# Option 1: Git clone
git clone <your-repo-url> .

# Option 2: Or manually copy files
# scp your files here

# Install dependencies
npm ci

# Install PM2 globally
npm install -g pm2

# Create .env file
cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
KUBECONFIG=/etc/k8s-playground/kubeconfig
BACKEND_URL=http://localhost:3001
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
CORS_ORIGIN=*
WS_UPDATE_INTERVAL=5000
ENABLE_REAL_CLUSTER=true
ENABLE_WEBSOCKET=true
EOF
```

#### Step 2A.3: Copy Kubeconfig to Backend

```bash
# From k8s-master, copy the kubeconfig
scp /tmp/kubeconfig-playground root@<backend-vm-ip>:/etc/k8s-playground/kubeconfig

# On backend VM, set permissions
mkdir -p /etc/k8s-playground
chmod 600 /etc/k8s-playground/kubeconfig
chmod 755 /etc/k8s-playground
```

#### Step 2A.4: Start Backend with PM2

```bash
cd /opt/k8s-playground

# Replace server.js with enhanced version or update current one
# Copy server-enhanced.js as server.js
cp server-enhanced.js server.js

# Start with PM2
pm2 start npm --name k8s-playground-backend -- start

# Save PM2 configuration
pm2 save

# Enable PM2 startup (auto-start on reboot)
pm2 startup

# Verify it's running
pm2 logs k8s-playground-backend
```

#### Step 2A.5: Test Backend

```bash
# From any machine with access to backend VM
curl http://<backend-vm-ip>:3001/api/health

# Should return:
# {
#   "status": "healthy",
#   "timestamp": "2025-12-12T...",
#   "cluster": {
#     "connected": true,
#     "context": "k8s-playground",
#     "server": "https://k8s-master:6443"
#   }
# }
```

### Option B: Deploy in Kubernetes

#### Step 2B.1: Create Secret with Kubeconfig

```bash
kubectl create secret generic k8s-playground-kubeconfig \
  -n k8s-playground \
  --from-file=kubeconfig=/tmp/kubeconfig-playground

# Verify
kubectl get secret -n k8s-playground
```

#### Step 2B.2: Apply Kubernetes Manifests

```bash
# Build and push Docker image (if needed)
docker build -t your-registry/k8s-playground-backend:latest .
docker push your-registry/k8s-playground-backend:latest

# Update the kubernetes-deployment.yaml with your image
# Then apply:
kubectl apply -f kubernetes-deployment.yaml

# Watch deployment
kubectl get pods -n k8s-playground -w

# Check logs
kubectl logs -n k8s-playground -l app=k8s-playground,component=backend

# Port forward for testing
kubectl port-forward -n k8s-playground svc/k8s-playground-backend 3001:3001
```

---

## PHASE 3: Deploy Frontend

### Step 3.1: Configure Backend URL

Update your `frontend-integration.js`:

```javascript
// At the top of the file
const BACKEND_URL = process.env.BACKEND_URL || 'http://<your-backend-ip>:3001';

// Update constructor
const clusterIntegration = new K8sRealClusterIntegration(BACKEND_URL);
```

Update `index.html` to reference correct paths:

```html
<!-- Update script sources to point to your backend -->
<script src="https://<your-backend-url>/socket.io/socket.io.js"></script>
```

### Step 3.2: Host Frontend

#### Option A: Static Server
```bash
# On frontend VM
cd /var/www/k8s-playground
python3 -m http.server 8000
```

#### Option B: Serve from Kubernetes
```bash
# Create Dockerfile for frontend
cat > Dockerfile.frontend << 'EOF'
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
COPY tutorials.html /usr/share/nginx/html/
COPY reference.html /usr/share/nginx/html/
COPY main.js /usr/share/nginx/html/
COPY frontend-integration.js /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

# Build and push
docker build -f Dockerfile.frontend -t your-registry/k8s-playground-frontend:latest .
docker push your-registry/k8s-playground-frontend:latest
```

---

## PHASE 4: Verify Complete Setup

### Step 4.1: Test All Endpoints

```bash
# Test backend health
curl http://<backend-ip>:3001/api/health

# Get cluster info
curl http://<backend-ip>:3001/api/cluster/info

# Get nodes
curl http://<backend-ip>:3001/api/nodes

# Get pods
curl http://<backend-ip>:3001/api/pods?namespace=default

# Get services
curl http://<backend-ip>:3001/api/services?namespace=default

# Get deployments
curl http://<backend-ip>:3001/api/deployments?namespace=default

# Get namespaces
curl http://<backend-ip>:3001/api/namespaces
```

### Step 4.2: Test WebSocket Connection

```bash
# Install websocat (WebSocket client)
apt install -y websocat

# Test connection
websocat ws://<backend-ip>:3001/socket.io/?EIO=4&transport=websocket

# You should see cluster updates every 5 seconds
```

### Step 4.3: Test from Frontend

1. Open `http://<frontend-ip>:8000` in browser
2. Check browser console for any errors
3. You should see:
   - Cluster nodes appearing
   - Real-time pod counts updating
   - Service and deployment info loading

---

## PHASE 5: Production Hardening

### Step 5.1: Enable HTTPS

```bash
# Use Let's Encrypt with certbot
apt install certbot python3-certbot-nginx

certbot certonly --standalone -d <your-domain>

# Update backend to use HTTPS
# Add to .env:
# HTTPS_KEY=/etc/letsencrypt/live/<your-domain>/privkey.pem
# HTTPS_CERT=/etc/letsencrypt/live/<your-domain>/fullchain.pem
```

### Step 5.2: Enable Authentication

Create a simple token-based auth:

```bash
# Generate a strong API key
openssl rand -base64 32
# Save to .env as API_KEY=<value>

# Update backend to check Authorization header
```

### Step 5.3: Set Up Monitoring

```bash
# Install Prometheus node exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xzf node_exporter-1.6.1.linux-amd64.tar.gz
pm2 start node_exporter-1.6.1.linux-amd64/node_exporter

# Create Prometheus scrape config pointing to backend
```

### Step 5.4: Enable Logging

```bash
# Install log rotation
apt install logrotate

# Create config
cat > /etc/logrotate.d/k8s-playground << 'EOF'
/var/log/k8s-playground.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
EOF
```

---

## PHASE 6: Troubleshooting

### Backend won't connect to cluster

```bash
# Check kubeconfig
KUBECONFIG=/etc/k8s-playground/kubeconfig kubectl cluster-info

# Check service account token validity
KUBECONFIG=/etc/k8s-playground/kubeconfig kubectl auth can-i get pods

# Check backend logs
pm2 logs k8s-playground-backend

# Verify network connectivity to API server
telnet k8s-master 6443
```

### Frontend shows "Cluster not connected"

```bash
# Check backend is running
curl http://<backend-ip>:3001/api/health

# Check CORS settings
# Your backend should allow requests from frontend domain

# Check browser console for errors
# F12 -> Console tab
```

### High memory usage

```bash
# Check Node.js process
ps aux | grep node

# Increase memory limit
# Edit PM2 config or .env

# Monitor memory
pm2 monitor
```

---

## PHASE 7: Users Can Now Use Playground

Your users can:
1. **View Real Cluster**: See actual nodes, pods, services
2. **Monitor Resources**: Real-time CPU/memory updates
3. **Explore Namespaces**: Browse all cluster namespaces
4. **View Deployments**: See active deployments and replicas
5. **Read Pod Logs**: Get pod logs for debugging
6. **Learn with Real Data**: Educational playground with live cluster

---

## Summary Checklist

- [ ] Created service account on cluster
- [ ] Generated kubeconfig for playground
- [ ] Deployed backend (VM or Kubernetes)
- [ ] Backend connects successfully to cluster
- [ ] All REST endpoints working
- [ ] WebSocket connection established
- [ ] Frontend configured with backend URL
- [ ] Frontend deployed and accessible
- [ ] Users can access and use playground
- [ ] Monitoring and logging set up
- [ ] HTTPS and security hardened

---

## Next Steps

After everything is working:

1. **Add User Authentication** - Secure the playground
2. **Add More Features** - Pod deletion, log tailing, exec into pods
3. **Create Tutorials** - Interactive labs using your real cluster
4. **Set Up CI/CD** - Auto-deploy updates
5. **Add Monitoring** - Prometheus + Grafana dashboards
6. **Create Backup Strategy** - Regular cluster backups

---

## Quick Command Reference

```bash
# Check cluster health
kubectl cluster-info

# Check nodes
kubectl get nodes -o wide

# Check playground backend namespace
kubectl get all -n k8s-playground

# View backend logs
pm2 logs k8s-playground-backend

# Test API endpoints
curl http://localhost:3001/api/cluster/info

# Test WebSocket
websocat ws://localhost:3001/socket.io/?EIO=4&transport=websocket
```
