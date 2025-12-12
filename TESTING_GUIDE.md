# Testing & Verification Guide

## Quick Test Suite for k8s-Playground Backend Connection

### Prerequisites
- Backend running (VM or Kubernetes)
- `curl` and `jq` installed for testing
- Access to backend URL (e.g., `http://localhost:3001`)

---

## Test 1: Basic Health Check

```bash
# Test backend is running
curl -s http://localhost:3001/api/health | jq .

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-12-12T...",
  "cluster": {
    "connected": true,
    "context": "k8s-playground",
    "server": "https://k8s-master:6443"
  }
}
```

---

## Test 2: Cluster Connectivity

```bash
# Test cluster connection
curl -s http://localhost:3001/api/health/cluster | jq .

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-12-12T...",
  "cluster": {
    "totalNodes": 3,
    "readyNodes": 3,
    "context": "k8s-playground",
    "server": "https://k8s-master:6443"
  }
}
```

---

## Test 3: Get Cluster Information

```bash
# Get overview of cluster resources
curl -s http://localhost:3001/api/cluster/info | jq .

# Expected response:
{
  "connected": true,
  "context": "k8s-playground",
  "apiServer": "https://k8s-master:6443",
  "nodes": 3,
  "readyNodes": 3,
  "pods": 45,
  "services": 12,
  "deployments": 8,
  "namespaces": 7,
  "timestamp": "2025-12-12T..."
}
```

---

## Test 4: List Nodes

```bash
# Get all cluster nodes
curl -s http://localhost:3001/api/nodes | jq '.[] | {name, status, ready, roles, cpu, memory}'

# Expected output:
{
  "name": "k8s-master",
  "status": "True",
  "ready": true,
  "roles": ["control-plane"],
  "cpu": "4",
  "memory": "8Gi"
}
{
  "name": "k8s-worker1",
  "status": "True",
  "ready": true,
  "roles": ["worker"],
  "cpu": "4",
  "memory": "8Gi"
}
{
  "name": "k8s-worker2",
  "status": "True",
  "ready": true,
  "roles": ["worker"],
  "cpu": "4",
  "memory": "8Gi"
}
```

---

## Test 5: Get Node Details

```bash
# Get detailed information for specific node
curl -s http://localhost:3001/api/nodes/k8s-master | jq .

# Expected response includes:
{
  "name": "k8s-master",
  "status": "True",
  "labels": {
    "kubernetes.io/hostname": "k8s-master",
    "node-role.kubernetes.io/control-plane": ""
  },
  "conditions": [...],
  "capacity": {...},
  "allocatable": {...},
  "nodeInfo": {...}
}
```

---

## Test 6: List Namespaces

```bash
# Get all namespaces
curl -s http://localhost:3001/api/namespaces | jq '.[] | {name, status, age}'

# Expected output:
{
  "name": "default",
  "status": "Active",
  "age": "29d"
}
{
  "name": "kube-system",
  "status": "Active",
  "age": "29d"
}
{
  "name": "kube-public",
  "status": "Active",
  "age": "29d"
}
...
```

---

## Test 7: List Pods (Default Namespace)

```bash
# Get pods in default namespace
curl -s 'http://localhost:3001/api/pods?namespace=default' | jq '.[] | {name, status, nodeName, restartCount}'

# Get pods in specific namespace
curl -s 'http://localhost:3001/api/pods?namespace=kube-system' | jq '.[] | {name, status, nodeName}'

# Expected format:
{
  "name": "my-app-deployment-5d8f6c8cd5-abc12",
  "status": "Running",
  "nodeName": "k8s-worker1",
  "restartCount": 0
}
```

---

## Test 8: Get Pod Logs

```bash
# Get logs from a pod
curl -s 'http://localhost:3001/api/pods/default/my-pod/logs'

# Get logs from specific container
curl -s 'http://localhost:3001/api/pods/default/my-pod/logs?container=app'

# Expected output:
# Raw log output from the pod
```

---

## Test 9: List Services

```bash
# Get services in default namespace
curl -s 'http://localhost:3001/api/services?namespace=default' | jq '.[] | {name, type, clusterIP, ports}'

# Expected output:
{
  "name": "my-service",
  "type": "ClusterIP",
  "clusterIP": "10.96.0.50",
  "ports": [
    {
      "name": "http",
      "port": 80,
      "targetPort": 8080
    }
  ]
}
```

---

## Test 10: List Deployments

```bash
# Get deployments in default namespace
curl -s 'http://localhost:3001/api/deployments?namespace=default' | \
  jq '.[] | {name, replicas, readyReplicas, availableReplicas}'

# Expected output:
{
  "name": "my-deployment",
  "replicas": 3,
  "readyReplicas": 3,
  "availableReplicas": 3
}
```

---

## Test 11: WebSocket Connection

```bash
# Install websocat if not available
# apt install websocat

# Connect to WebSocket
websocat ws://localhost:3001/socket.io/?EIO=4&transport=websocket

# You should see cluster updates every 5 seconds:
# {"connected":true,"nodes":[...],"pods":45,"services":12,...}
```

---

## Test 12: Load Testing (Rate Limiting)

```bash
# Test rate limiting
for i in {1..150}; do
  curl -s http://localhost:3001/api/cluster/info > /dev/null
  echo "Request $i"
done | tail -20

# After 100 requests within 60 seconds, should get 429 responses:
# curl -s http://localhost:3001/api/cluster/info | jq .
# {"error":"Rate limit exceeded"}
```

---

## Test 13: Node Health Check

```bash
# Get detailed node health
curl -s http://localhost:3001/api/health/nodes | jq '.nodes[] | {name, ready, conditions}'

# Expected output:
{
  "name": "k8s-master",
  "ready": true,
  "conditions": [
    {
      "type": "Ready",
      "status": "True",
      "message": "kubelet is posting ready status"
    }
  ]
}
```

---

## Test 14: Cluster Details

```bash
# Get cluster configuration details
curl -s http://localhost:3001/api/cluster/details | jq .

# Expected output:
{
  "cluster": {
    "name": "k8s-playground",
    "server": "https://k8s-master:6443",
    "caFile": "configured",
    "insecureSkipTlsVerify": false
  },
  "user": {
    "name": "k8s-playground-admin",
    "authProvider": "configured"
  },
  "context": "k8s-playground"
}
```

---

## Automated Test Script

Create a file called `test-playground.sh`:

```bash
#!/bin/bash

BACKEND_URL="${1:-http://localhost:3001}"
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local endpoint=$2
    local expected_status=$3
    
    echo -n "Testing $name... "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL$endpoint")
    
    if [ "$status" = "$expected_status" ]; then
        echo "✓ PASS ($status)"
        ((PASSED++))
    else
        echo "✗ FAIL (got $status, expected $expected_status)"
        ((FAILED++))
    fi
}

echo "k8s-Playground Backend Tests"
echo "Backend URL: $BACKEND_URL"
echo ""

test_endpoint "Health" "/api/health" "200"
test_endpoint "Cluster Health" "/api/health/cluster" "200"
test_endpoint "Cluster Info" "/api/cluster/info" "200"
test_endpoint "Cluster Details" "/api/cluster/details" "200"
test_endpoint "Nodes" "/api/nodes" "200"
test_endpoint "Namespaces" "/api/namespaces" "200"
test_endpoint "Services" "/api/services" "200"
test_endpoint "Pods" "/api/pods" "200"
test_endpoint "Deployments" "/api/deployments" "200"
test_endpoint "Not Found" "/api/invalid" "404"

echo ""
echo "Results: $PASSED passed, $FAILED failed"

if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
```

Run it:
```bash
chmod +x test-playground.sh
./test-playground.sh http://localhost:3001
```

---

## Troubleshooting Failed Tests

### Test fails with "Connection refused"
```bash
# Backend not running. Check:
ps aux | grep node
pm2 logs k8s-playground-backend
```

### Test fails with "Cluster not connected"
```bash
# Kubeconfig issue. Check:
KUBECONFIG=/etc/k8s-playground/kubeconfig kubectl cluster-info
KUBECONFIG=/etc/k8s-playground/kubeconfig kubectl get nodes
```

### Test fails with permission errors
```bash
# Service account permissions. Check:
kubectl get clusterrolebinding | grep k8s-playground
kubectl auth can-i list pods --as=system:serviceaccount:k8s-playground-backend:k8s-playground-admin
```

### Test returns empty results
```bash
# Check if cluster has resources:
kubectl get nodes
kubectl get pods -A
kubectl get services -A
```

---

## Performance Testing

```bash
# Test response time
for i in {1..10}; do
  time curl -s http://localhost:3001/api/cluster/info > /dev/null
done

# Measure WebSocket latency
time websocat ws://localhost:3001/socket.io/?EIO=4&transport=websocket
```

---

## Next Steps After Testing

1. ✅ All tests passing → Backend is properly connected
2. Update frontend to use backend URL
3. Deploy frontend and test user access
4. Monitor backend logs in production
5. Set up alerting for failures
