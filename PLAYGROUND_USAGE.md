# Kubernetes Playground - Usage Guide

## Overview
The K8s Playground is now fully functional with an interactive terminal for executing kubectl commands. It works in two modes:
- **Mock Mode** (current): Simulated cluster data for testing
- **Real Mode**: Connect to your actual Kubernetes cluster

## Web Interface Access

### Codespaces URLs
- **Frontend (Web UI)**: https://friendly-space-memory-g4w6p5pw55r9fw4v-8000.app.github.dev
- **Backend (API)**: https://friendly-space-memory-g4w6p5pw55r9fw4v-3001.app.github.dev

Replace `friendly-space-memory-g4w6p5pw55r9fw4v` with your actual Codespace name if different.

## Terminal Features

The integrated Kubectl Terminal allows you to:

### Available Commands (Mock Mode)
```bash
kubectl get nodes          # List all nodes
kubectl get pods           # List all pods
kubectl get services       # List all services
kubectl get deployments    # List all deployments
kubectl get namespaces     # List all namespaces
kubectl describe <resource> <name>
kubectl logs <pod-name>
kubectl create namespace <name>
```

### Example Commands
```bash
# View your 3-node cluster
$ kubectl get nodes
NAME           STATUS   ROLES    AGE     VERSION
k8s-master     Ready    control-plane  48h    1.32.10
k8s-worker1    Ready    worker   17h    1.31.14
k8s-worker2    Ready    worker   47h    1.31.14

# View running pods
$ kubectl get pods

# View namespaces
$ kubectl get ns
NAME              STATUS   AGE
default           Active   45d
kube-system       Active   45d
playground        Active   10m
monitoring        Active   8d
```

## Cluster Configuration

### Step 1: Configure Cluster Settings
In the **Cluster Controls** panel on the left sidebar:
1. Enter your **API Server** URL: `https://k8s-master:6443`
2. Enter **Namespace**: `playground` (recommended)
3. Click **Connect Cluster**

### Step 2: Automatic Setup
The playground will automatically:
- Create the `playground` namespace
- Set up RBAC (ServiceAccount, Role, RoleBinding)
- Configure namespace access
- Display connection status

## Connecting to Your Real Cluster

### Prerequisites
You have a 3-node Kubernetes cluster:
- **Control Plane**: k8s-master (https://k8s-master:6443)
- **Workers**: k8s-worker1, k8s-worker2
- **Versions**: 1.31.14 - 1.32.10

### Method 1: Using kubeconfig (Recommended for Production)

1. **Get your kubeconfig** from your cluster admin
2. **Copy the kubeconfig content** (entire YAML)
3. Create a file in the Codespace:
```bash
mkdir -p ~/.kube
# Paste the kubeconfig content into ~/.kube/config
nano ~/.kube/config
# Ctrl+X, Y, Enter to save
```

4. **Update the backend environment**:
```bash
export KUBECONFIG=~/.kube/config
MOCK_MODE=false npm start
```

5. **Connect in the playground**:
- Go to Cluster Controls
- Enter API Server: `https://k8s-master:6443`
- Click **Connect Cluster**

### Method 2: Using Service Account Token (For Playground Access)

1. **Create a service account** on your cluster:
```bash
kubectl create namespace playground
kubectl create serviceaccount playground-user -n playground
kubectl create rolebinding playground-admin --clusterrole=admin --serviceaccount=playground:playground-user -n playground
```

2. **Get the token**:
```bash
kubectl get secret -n playground $(kubectl get secret -n playground | grep playground-user | awk '{print $1}') -o jsonpath='{.data.token}' | base64 -d
```

3. **In the playground**, use the terminal to execute commands in the playground namespace

## RBAC & Namespace Isolation

### Automatic RBAC Setup
When you click **Connect Cluster**, the playground automatically creates:

**ServiceAccount**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: playground-user
  namespace: playground
```

**Role** (limited to playground namespace)
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: playground-role
  namespace: playground
rules:
- apiGroups: [""]
  resources: ["pods", "services", "persistentvolumeclaims"]
  verbs: ["get", "list", "watch", "create", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "statefulsets"]
  verbs: ["get", "list", "watch", "create", "delete", "patch"]
```

**RoleBinding**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: playground-rolebinding
  namespace: playground
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: playground-role
subjects:
- kind: ServiceAccount
  name: playground-user
  namespace: playground
```

### Security Features
✅ **Namespace Isolation**: All playground operations are confined to the `playground` namespace  
✅ **RBAC Controlled**: Only essential operations are allowed  
✅ **No Cluster Admin**: Limited to namespace-level permissions  
✅ **Audit Trail**: All operations logged and trackable  

## Playground Features

### Dashboard
- Real-time cluster metrics
- Node status and utilization
- Pod count and status
- Service overview
- Deployment tracking

### Cluster Controls
- Add/Remove worker nodes (mock mode)
- Adjust CPU and memory allocation
- Deploy pre-configured applications
- Create custom pods via Pod Builder

### Pod Builder
Create custom pods with:
- Image selection (Nginx, Redis, PostgreSQL, custom)
- Resource requests and limits
- Environment variables
- YAML preview
- One-click deployment

### Visualizations
- Cluster topology with D3.js
- Resource usage charts
- Real-time metrics
- Network performance graphs

## Troubleshooting

### Terminal Not Responding
- Check backend is running: `curl http://localhost:3001/api/health`
- Restart backend: `pkill -f "node server.js" && MOCK_MODE=true npm start`

### Cluster Connection Failed
- Verify API server URL is correct
- Check network connectivity to cluster
- Confirm kubeconfig permissions
- View backend logs: `tail -f /tmp/backend.log`

### Mock Mode vs Real Mode
- **Current Mode**: `Mock Mode` (shown in terminal header)
- **Switch to Real**: Set `KUBECONFIG` and restart backend with `MOCK_MODE=false`

## Environment Variables

```bash
# Current environment
MOCK_MODE=true              # Use simulated cluster
NODE_ENV=development        # Development mode
PORT=3001                   # API server port
CORS_ORIGIN=*              # Allow all origins
KUBECONFIG=~/.kube/config  # Path to kubeconfig (when real mode)
```

## Next Steps

1. **Explore Mock Mode**: Get familiar with the UI and terminal
2. **Configure Your Cluster**: Add your API server details
3. **Test Basic Commands**: Try kubectl get commands
4. **Deploy Applications**: Use Pod Builder for custom deployments
5. **Connect Real Cluster**: Follow Method 1 or 2 above

## Support

For issues or questions:
- Check backend logs: `npm start` (shows detailed output)
- Terminal output shows actual error messages
- API endpoints return JSON with error details

---

**Ready to use?** Open the playground: https://friendly-space-memory-g4w6p5pw55r9fw4v-8000.app.github.dev

