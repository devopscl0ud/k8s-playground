# CI/CD Pipeline Troubleshooting Guide

## Overview

This guide helps you diagnose and fix issues when your Jenkins CI/CD pipeline fails to deploy applications to your Kubernetes cluster. The most common issue is that the application builds successfully but doesn't get deployed.

---

## Quick Diagnosis

If your build shows `SUCCESS` but deployment isn't happening, follow these steps:

### 1. Run the Troubleshooting Script

```bash
./scripts/02-troubleshoot-cicd.sh
```

This script automatically checks for common issues and provides fixes.

### 2. Check Kubernetes Cluster Connection

```bash
# Verify the namespace exists
kubectl get namespace k8s-playground

# Check if deployment exists
kubectl -n k8s-playground get deployment k8s-playground-backend

# View pod status
kubectl -n k8s-playground get pods
```

---

## Common Issues and Fixes

### Issue #1: "kubectl: command not found" in Jenkins Build

**Cause:** Jenkins container doesn't have kubectl installed.

**Solution:**
```bash
# In Docker container running Jenkins, install kubectl
docker exec jenkins-container apt-get update && apt-get install -y kubectl

# OR use Jenkins plugin: Kubernetes CLI plugin
# In Jenkins: Manage Jenkins → Manage Plugins → Search "Kubernetes CLI" → Install
```

---

### Issue #2: "Deployment not found" error

**Cause:** The Kubernetes deployment `k8s-playground-backend` doesn't exist yet.

**Solution:** Run the initialization script on your cluster:

```bash
# From your repository root
./scripts/01-init-cluster.sh

# If you have Docker Hub private repo, provide credentials:
./scripts/01-init-cluster.sh your_docker_username your_docker_pat_token
```

This creates:
- ✅ Namespace (`k8s-playground`)
- ✅ ServiceAccount
- ✅ Deployment
- ✅ Service
- ✅ ConfigMap
- ✅ HorizontalPodAutoscaler

---

### Issue #3: "kubeconfig-credentials not found" in Jenkins

**Cause:** The kubeconfig credential isn't configured in Jenkins.

**Solution:**

1. **Generate kubeconfig for Jenkins:**
   ```bash
   ./scripts/01-init-cluster.sh
   ```

2. **Add to Jenkins:**
   - Open Jenkins UI
   - Go to: **Manage Jenkins** → **Manage Credentials** → **System** → **Global credentials (unrestricted)**
   - Click **Add Credentials**
   - Select: **Secret file**
   - Click "Choose File" and upload the kubeconfig file (created by the script)
   - Set **ID** to: `kubeconfig-credentials`
   - Click **Create**

3. **Verify:**
   ```bash
   kubectl --kubeconfig /path/to/kubeconfig cluster-info
   ```

---

### Issue #4: "docker-hub-creds not found" in Jenkins

**Cause:** Docker Hub credentials aren't set up in Jenkins.

**Solution:**

1. **Generate Docker Hub Personal Access Token (PAT):**
   - Go to: https://hub.docker.com/settings/security
   - Click "New Access Token"
   - Copy the token

2. **Add to Jenkins:**
   - Open Jenkins UI
   - Go to: **Manage Jenkins** → **Manage Credentials** → **System** → **Global credentials (unrestricted)**
   - Click **Add Credentials**
   - Select: **Username with password**
   - **Username:** Your Docker Hub username
   - **Password:** Your Docker Hub PAT (from step 1)
   - Set **ID** to: `docker-hub-creds`
   - Click **Create**

---

### Issue #5: "Cannot connect to Kubernetes cluster" in Jenkins

**Cause:** The kubeconfig credentials can't reach the cluster.

**Symptoms:**
```
error: error loading config file "/var/lib/jenkins/kubeconfig": stat /var/lib/jenkins/kubeconfig: no such file or directory
```

**Solution:**

1. **Verify kubeconfig exists locally:**
   ```bash
   kubectl config view
   ```

2. **Test kubeconfig from Jenkins container:**
   ```bash
   # Get into Jenkins container and test
   kubectl --kubeconfig /var/run/secrets/kubeconfig cluster-info
   ```

3. **Check if the cluster API server is reachable:**
   ```bash
   # From your local machine
   curl -k https://your-cluster-api-server:6443/api/v1/namespaces/k8s-playground
   ```

4. **If using a private cluster**, ensure:
   - Firewall rules allow Jenkins container to reach API server
   - VPN/Bastion host is configured if needed
   - Service account token has proper permissions

---

### Issue #6: "imagePullBackOff" or "ErrImagePull"

**Cause:** The Docker image can't be pulled from the registry.

**Symptoms:**
```bash
$ kubectl -n k8s-playground get pods
NAME                          READY   STATUS             
k8s-playground-backend-xxx    0/1     ImagePullBackOff   

$ kubectl -n k8s-playground describe pod k8s-playground-backend-xxx
Events:
  Type     Reason                 Age                  
  Warning  Failed                 20s (x2 over 40s)    
  Normal   BackOff                15s (x2 over 30s)    
  Warning  FailedScheduling       5s                   
  Message  Back-off pulling image "docker.io/venky2222/k8s-playground-backend:123-abc7def"
```

**Solution:**

1. **Verify image exists in registry:**
   ```bash
   docker pull docker.io/venky2222/k8s-playground-backend:123-abc7def
   ```

2. **Create Docker registry secret:**
   ```bash
   kubectl create secret docker-registry registry-credentials \
     --docker-server=https://index.docker.io/v1/ \
     --docker-username=venky2222 \
     --docker-password=YOUR_DOCKER_PAT \
     -n k8s-playground --dry-run=client -o yaml | kubectl apply -f -
   ```

3. **Verify secret is attached to pod:**
   ```bash
   kubectl -n k8s-playground get pods -o jsonpath='{.items[0].spec.imagePullSecrets}'
   ```

---

### Issue #7: CrashLoopBackOff or pod not starting

**Cause:** The application is crashing on startup.

**Solution:**

1. **Check pod logs:**
   ```bash
   kubectl -n k8s-playground logs k8s-playground-backend-xxx
   
   # Or follow logs in real-time
   kubectl -n k8s-playground logs -f k8s-playground-backend-xxx
   ```

2. **Check recent pod events:**
   ```bash
   kubectl -n k8s-playground describe pod k8s-playground-backend-xxx
   kubectl -n k8s-playground get events --sort-by='.lastTimestamp'
   ```

3. **Common reasons:**
   - Port already in use (change PORT in ConfigMap)
   - Missing environment variables (check ConfigMap)
   - Database connection issues (check CORS_ORIGIN in ConfigMap)
   - Resource limits too low (check requests/limits in deployment)

4. **Update ConfigMap and restart:**
   ```bash
   kubectl edit configmap -n k8s-playground k8s-playground-config
   # Make changes and save
   
   # Rolling restart
   kubectl -n k8s-playground rollout restart deployment/k8s-playground-backend
   ```

---

### Issue #8: Pod pending or taking too long to start

**Cause:** Resource constraints or node affinity issues.

**Symptoms:**
```bash
$ kubectl -n k8s-playground get pods
NAME                              READY   STATUS    
k8s-playground-backend-xxx        0/1     Pending   1h
```

**Solution:**

1. **Check pod events for reasons:**
   ```bash
   kubectl -n k8s-playground describe pod k8s-playground-backend-xxx | grep -A 20 Events:
   ```

2. **Common reasons:**
   - Insufficient CPU/memory on nodes
   - Pod anti-affinity preventing scheduling
   - Node selectors or taints

3. **Check node resources:**
   ```bash
   kubectl top nodes
   kubectl describe nodes
   ```

4. **Temporarily disable pod anti-affinity:**
   ```bash
   kubectl -n k8s-playground patch deployment k8s-playground-backend --type='json' \
     -p='[{"op": "remove", "path": "/spec/template/spec/affinity"}]'
   ```

---

### Issue #9: StatefulSet or DaemonSet not deploying

**Cause:** If using StatefulSet instead of Deployment (for persistent storage).

**Solution:**

```bash
# Check if PersistentVolume is created
kubectl get pv

# Check PersistentVolumeClaim
kubectl -n k8s-playground get pvc

# Check storage class
kubectl get storageclass
```

---

### Issue #10: Network connectivity issues

**Cause:** NetworkPolicy might be blocking traffic.

**Solution:**

1. **Check NetworkPolicy:**
   ```bash
   kubectl -n k8s-playground get networkpolicy
   kubectl -n k8s-playground describe networkpolicy k8s-playground-network-policy
   ```

2. **Test pod-to-pod connectivity:**
   ```bash
   # Exec into a pod
   kubectl -n k8s-playground exec -it k8s-playground-backend-xxx -- /bin/bash
   
   # From pod, try to reach service
   curl http://k8s-playground-backend:3001/api/health
   ```

3. **If NetworkPolicy is blocking, temporarily disable:**
   ```bash
   kubectl -n k8s-playground patch networkpolicy k8s-playground-network-policy \
     --type merge --patch '{"spec":{"policyTypes":[]}}'
   ```

---

## Step-by-Step Debugging Workflow

### Step 1: Verify Cluster Setup
```bash
# Check kubectl connection
kubectl cluster-info

# List namespaces
kubectl get namespaces

# List resources in k8s-playground namespace
kubectl -n k8s-playground get all
```

### Step 2: Run Automated Diagnostic
```bash
./scripts/02-troubleshoot-cicd.sh
```

### Step 3: Check Deployment
```bash
# Get deployment status
kubectl -n k8s-playground get deployment k8s-playground-backend -o wide

# View deployment details
kubectl -n k8s-playground describe deployment k8s-playground-backend

# Check recent events
kubectl -n k8s-playground get events --sort-by='.lastTimestamp' | tail -20
```

### Step 4: Check Pods
```bash
# Get pod status
kubectl -n k8s-playground get pods -o wide

# Describe problematic pod
kubectl -n k8s-playground describe pod POD_NAME

# Check logs
kubectl -n k8s-playground logs POD_NAME

# Exec into pod for debugging
kubectl -n k8s-playground exec -it POD_NAME -- /bin/bash
```

### Step 5: Check Service
```bash
# Get service details
kubectl -n k8s-playground get service k8s-playground-backend -o wide

# Test service from another pod
kubectl -n k8s-playground run -it --rm test --image=curlimages/curl --restart=Never -- \
  curl -v http://k8s-playground-backend:3001/api/health
```

### Step 6: Check Jenkins Pipeline Execution
```bash
# If stuck in Jenkins, check:
# 1. Jenkins logs
docker logs jenkins-container | tail -50

# 2. Jenkins job build log
# Open Jenkins UI → Job → Latest Build → Console Output

# 3. Check if kubeconfig is mounted
docker exec jenkins-container ls -la /var/lib/jenkins/kubeconfig
```

---

## Jenkins Configuration Checklist

- [ ] Jenkins has **kubeconfig-credentials** with ID `kubeconfig-credentials`
- [ ] Jenkins has **docker-hub-creds** with ID `docker-hub-creds`
- [ ] Jenkinsfile is in repository root
- [ ] GitHub webhook is configured pointing to Jenkins
- [ ] Jenkins `URL` is reachable from GitHub (if using webhook)
- [ ] Git credentials are configured in Jenkins (if private repo)
- [ ] Kubernetes cluster is reachable from Jenkins container
- [ ] Docker daemon is available to Jenkins container
- [ ] kubectl is installed in Jenkins container

---

## Kubernetes Cluster Checklist

- [ ] Namespace `k8s-playground` exists
- [ ] ServiceAccount `k8s-playground-admin` exists
- [ ] ClusterRoleBinding for service account exists
- [ ] Deployment `k8s-playground-backend` exists
- [ ] Service `k8s-playground-backend` exists
- [ ] ConfigMap `k8s-playground-config` exists
- [ ] Registry secret `registry-credentials` exists (for private repos)
- [ ] At least one pod is "Running"
- [ ] All cluster nodes have sufficient resources

---

## Advanced Debugging

### Enable debug logging in kubectl
```bash
kubectl --v=8 -n k8s-playground get deployment
```

### Watch pod status in real-time
```bash
kubectl -n k8s-playground get pods -w
```

### Stream logs from all pods
```bash
kubectl -n k8s-playground logs -l app=k8s-playground -f --all-containers=true
```

### Check resource utilization
```bash
kubectl top node
kubectl top pod -n k8s-playground
```

### Export deployment for backup/migration
```bash
kubectl -n k8s-playground get deployment k8s-playground-backend -o yaml > deployment-backup.yaml
```

---

## Performance Tuning

### Increase deployment replicas
```bash
kubectl -n k8s-playground scale deployment k8s-playground-backend --replicas=3
```

### Adjust resource limits
```bash
kubectl -n k8s-playground set resources deployment k8s-playground-backend \
  --limits=cpu=1000m,memory=1Gi \
  --requests=cpu=250m,memory=512Mi
```

### Check HPA status
```bash
kubectl -n k8s-playground get hpa
kubectl -n k8s-playground describe hpa k8s-playground-backend
```

---

## Getting Help

If the issue persists after following this guide:

1. **Run and capture diagnostic output:**
   ```bash
   ./scripts/02-troubleshoot-cicd.sh > /tmp/diagnostic-report.txt
   kubectl -n k8s-playground get all -o yaml > /tmp/k8s-resources.yaml
   kubectl get events -A > /tmp/all-events.txt
   ```

2. **Check Jenkins logs:**
   ```bash
   docker logs jenkins-container 2>&1 | tail -100 > /tmp/jenkins-logs.txt
   ```

3. **Open a GitHub issue** with these files attached

---

## Quick Reference Commands

```bash
# Initialize cluster
./scripts/01-init-cluster.sh [docker_username] [docker_pat]

# Run diagnostics
./scripts/02-troubleshoot-cicd.sh

# View all resources
kubectl -n k8s-playground get all

# Stream deployment logs
kubectl -n k8s-playground logs -f -l app=k8s-playground

# Restart deployment
kubectl -n k8s-playground rollout restart deployment/k8s-playground-backend

# Watch rollout status
kubectl -n k8s-playground rollout status deployment/k8s-playground-backend -w

# Get deployment YAML
kubectl -n k8s-playground get deployment k8s-playground-backend -o yaml

# Edit deployment
kubectl -n k8s-playground edit deployment k8s-playground-backend

# Delete and recreate
kubectl -n k8s-playground delete deployment k8s-playground-backend
kubectl apply -f kubernetes-deployment.yaml

# Check resource usage
kubectl top pod -n k8s-playground --sort-by=memory
```

---

**Last Updated:** April 16, 2026
