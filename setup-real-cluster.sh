#!/bin/bash

# K8s Playground Real Cluster Setup Script
# This script helps you connect the playground to your real Kubernetes cluster

set -e

echo "=========================================="
echo "K8s Playground - Real Cluster Setup"
echo "=========================================="
echo ""

# Check if kubeconfig file is provided
if [ $# -eq 0 ]; then
    echo "Usage: ./setup-real-cluster.sh <path-to-kubeconfig>"
    echo ""
    echo "Example:"
    echo "  ./setup-real-cluster.sh ~/.kube/config"
    echo ""
    echo "Or provide kubeconfig content:"
    echo "  cat ~/.kube/config | ./setup-real-cluster.sh"
    exit 1
fi

KUBECONFIG_PATH=$1

# Check if file exists
if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo "❌ Error: Kubeconfig file not found: $KUBECONFIG_PATH"
    exit 1
fi

echo "✓ Found kubeconfig: $KUBECONFIG_PATH"
echo ""

# Copy kubeconfig to the container
echo "📋 Setting up kubeconfig..."
mkdir -p ~/.kube
cp "$KUBECONFIG_PATH" ~/.kube/config
chmod 600 ~/.kube/config

# Verify kubeconfig
echo "🔍 Verifying kubeconfig..."
if kubectl cluster-info &> /dev/null; then
    CLUSTER_NAME=$(kubectl config current-context)
    SERVER=$(kubectl cluster-info 2>/dev/null | grep 'Kubernetes master' | awk '{print $NF}')
    echo "✓ Successfully connected to cluster"
    echo "  Context: $CLUSTER_NAME"
    echo "  Server: $SERVER"
else
    echo "⚠️  Warning: Could not verify cluster connection"
    echo "   Please ensure your kubeconfig is valid"
fi

echo ""
echo "📦 Creating playground namespace and RBAC..."

# Create namespace
kubectl create namespace playground --dry-run=client -o yaml | kubectl apply -f -
echo "✓ Namespace 'playground' created"

# Create ServiceAccount
kubectl create serviceaccount playground-user -n playground --dry-run=client -o yaml | kubectl apply -f -
echo "✓ ServiceAccount 'playground-user' created"

# Create Role
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: playground-role
  namespace: playground
rules:
- apiGroups: [""]
  resources: ["pods", "services", "persistentvolumeclaims", "configmaps"]
  verbs: ["get", "list", "watch", "create", "delete", "patch"]
- apiGroups: ["apps"]
  resources: ["deployments", "statefulsets", "daemonsets"]
  verbs: ["get", "list", "watch", "create", "delete", "patch"]
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["get", "list", "watch", "create", "delete"]
EOF
echo "✓ Role 'playground-role' created"

# Create RoleBinding
kubectl apply -f - <<EOF
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
EOF
echo "✓ RoleBinding 'playground-rolebinding' created"

echo ""
echo "🚀 Restarting playground backend..."

# Kill any running backend
pkill -f "node server.js" || true
sleep 2

# Start backend with real cluster
cd /workspaces/k8s-playground
export KUBECONFIG=~/.kube/config
export MOCK_MODE=false
npm start > /tmp/backend.log 2>&1 &

sleep 3

# Verify backend is running
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✓ Backend started successfully"
    echo ""
    echo "=========================================="
    echo "✅ Setup Complete!"
    echo "=========================================="
    echo ""
    echo "📍 Playground is ready for real cluster:"
    echo "   https://friendly-space-memory-g4w6p5pw55r9fw4v-8000.app.github.dev"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Open the playground in your browser"
    echo "   2. Configure cluster settings in Cluster Controls"
    echo "   3. Try: kubectl get nodes"
    echo ""
else
    echo "❌ Error: Backend failed to start"
    echo "   Check logs: tail -f /tmp/backend.log"
    exit 1
fi
