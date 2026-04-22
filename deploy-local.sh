#!/bin/bash
# Deployment script for k8s-playground application

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}k8s-Playground Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check cluster connection
echo "Checking Kubernetes cluster connection..."
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✓ Cluster connection verified${NC}"
else
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

# Create deployment using kubectl with docker image
echo -e "\n${YELLOW}Deploying application...${NC}"

# Apply the Kubernetes manifests with the built image
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: k8s-playground
  labels:
    app: k8s-playground

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: k8s-playground-admin
  namespace: k8s-playground
  labels:
    app: k8s-playground

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: k8s-playground-admin
  labels:
    app: k8s-playground
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "pods/logs"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "deployments/scale"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: k8s-playground-admin
  labels:
    app: k8s-playground
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: k8s-playground-admin
subjects:
- kind: ServiceAccount
  name: k8s-playground-admin
  namespace: k8s-playground

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: k8s-playground-config
  namespace: k8s-playground
  labels:
    app: k8s-playground
data:
  PORT: "3001"
  NODE_ENV: "production"
  RATE_LIMIT_WINDOW: "60000"
  RATE_LIMIT_MAX: "100"
  LOG_LEVEL: "info"
  WS_UPDATE_INTERVAL: "5000"
  ENABLE_REAL_CLUSTER: "false"
  ENABLE_WEBSOCKET: "true"
  CORS_ORIGIN: "*"
  MOCK_MODE: "true"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k8s-playground-backend
  namespace: k8s-playground
  labels:
    app: k8s-playground
    component: backend
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: k8s-playground
      component: backend
  template:
    metadata:
      labels:
        app: k8s-playground
        component: backend
    spec:
      serviceAccountName: k8s-playground-admin
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: backend
        image: k8s-playground:latest
        imagePullPolicy: Never
        workingDir: /app
        command: ["npm", "start"]
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP
        env:
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: k8s-playground-config
              key: PORT
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: k8s-playground-config
              key: NODE_ENV
        - name: MOCK_MODE
          valueFrom:
            configMapKeyRef:
              name: k8s-playground-config
              key: MOCK_MODE
        - name: CORS_ORIGIN
          valueFrom:
            configMapKeyRef:
              name: k8s-playground-config
              key: CORS_ORIGIN
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2

---
apiVersion: v1
kind: Service
metadata:
  name: k8s-playground-backend
  namespace: k8s-playground
  labels:
    app: k8s-playground
    component: backend
spec:
  type: NodePort
  selector:
    app: k8s-playground
    component: backend
  ports:
  - name: http
    port: 3001
    targetPort: 3001
    protocol: TCP
EOF

echo -e "${GREEN}✓ Kubernetes manifests applied${NC}"

# Wait for deployment
echo -e "\n${YELLOW}Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/k8s-playground-backend -n k8s-playground --timeout=2m || true

# Get service info
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Status${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo "Namespace: k8s-playground"
echo -e "\n${YELLOW}Deployments:${NC}"
kubectl get deployments -n k8s-playground

echo -e "\n${YELLOW}Pods:${NC}"
kubectl get pods -n k8s-playground

echo -e "\n${YELLOW}Services:${NC}"
kubectl get services -n k8s-playground

# Get NodePort info
SERVICE_PORT=$(kubectl get service k8s-playground-backend -n k8s-playground -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "Not assigned yet")
echo -e "\n${GREEN}Service Port: ${SERVICE_PORT}${NC}"

echo -e "\n${YELLOW}Pod Logs:${NC}"
echo "To view logs: kubectl logs -n k8s-playground -l app=k8s-playground -f"

echo -e "\n${GREEN}✓ Deployment complete!${NC}\n"
