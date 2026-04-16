#!/bin/bash

# ============================================================================
# k8s-playground: CI/CD Troubleshooting Script
# ============================================================================
# This script diagnoses common CI/CD issues and provides fixes
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="k8s-playground"

print_header() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

check_namespace() {
  print_header "Checking Namespace"
  
  if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    print_error "Namespace '$NAMESPACE' does not exist"
    echo "    FIX: Run 'kubectl create namespace $NAMESPACE'"
    return 1
  fi
  
  print_success "Namespace '$NAMESPACE' exists"
  return 0
}

check_deployment() {
  print_header "Checking Deployment"
  
  if ! kubectl -n $NAMESPACE get deployment k8s-playground-backend &> /dev/null; then
    print_error "Deployment 'k8s-playground-backend' not found"
    echo "    FIX: Run './scripts/01-init-cluster.sh' to bootstrap resources"
    return 1
  fi
  
  print_success "Deployment 'k8s-playground-backend' exists"
  
  # Check deployment status
  READY=$(kubectl -n $NAMESPACE get deployment k8s-playground-backend -o jsonpath='{.status.readyReplicas}')
  DESIRED=$(kubectl -n $NAMESPACE get deployment k8s-playground-backend -o jsonpath='{.spec.replicas}')
  
  echo "    Replicas: $READY/$DESIRED ready"
  
  if [ "$READY" != "$DESIRED" ]; then
    print_warning "Not all replicas are ready"
    echo ""
    echo "    Pod status:"
    kubectl -n $NAMESPACE get pods -l app=k8s-playground,component=backend
    echo ""
    echo "    Recent events:"
    kubectl -n $NAMESPACE describe deployment k8s-playground-backend | grep -A 20 "Events:"
    return 1
  fi
  
  print_success "All replicas are ready"
  return 0
}

check_image_pull() {
  print_header "Checking Image Pull"
  
  PODS=$(kubectl -n $NAMESPACE get pods -l app=k8s-playground,component=backend -o jsonpath='{.items[*].metadata.name}')
  
  if [ -z "$PODS" ]; then
    print_warning "No pods found"
    return 1
  fi
  
  for POD in $PODS; do
    print_info "Checking pod: $POD"
    
    # Check for image pull errors
    IMAGE_PULL_ERROR=$(kubectl -n $NAMESPACE describe pod $POD | grep -i "imagepull" | wc -l)
    
    if [ $IMAGE_PULL_ERROR -gt 0 ]; then
      print_error "Image pull error detected"
      echo ""
      echo "    Pod events:"
      kubectl -n $NAMESPACE describe pod $POD | grep -A 10 "Events:"
      return 1
    fi
  done
  
  print_success "No image pull errors"
  return 0
}

check_registry_credentials() {
  print_header "Checking Registry Credentials"
  
  if ! kubectl -n $NAMESPACE get secret registry-credentials &> /dev/null; then
    print_warning "Registry secret 'registry-credentials' not found"
    echo "    FIX: Run this command to create it:"
    echo "      kubectl create secret docker-registry registry-credentials \\"
    echo "        --docker-server=https://index.docker.io/v1/ \\"
    echo "        --docker-username=YOUR_USERNAME \\"
    echo "        --docker-password=YOUR_PAT_TOKEN \\"
    echo "        -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -"
    return 1
  fi
  
  print_success "Registry secret exists"
  return 0
}

check_service_account() {
  print_header "Checking Service Account"
  
  if ! kubectl -n $NAMESPACE get serviceaccount k8s-playground-admin &> /dev/null; then
    print_error "Service account 'k8s-playground-admin' not found"
    echo "    FIX: Run './scripts/01-init-cluster.sh'"
    return 1
  fi
  
  print_success "Service account exists"
  
  # Check if it has permissions
  if ! kubectl get clusterrolebinding | grep k8s-playground &> /dev/null; then
    print_warning "Service account may not have cluster role binding"
    echo "    FIX: Run this command:"
    echo "      kubectl create clusterrolebinding k8s-playground-admin \\"
    echo "        --clusterrole=cluster-admin \\"
    echo "        --serviceaccount=$NAMESPACE:k8s-playground-admin \\"
    echo "        --dry-run=client -o yaml | kubectl apply -f -"
    return 1
  fi
  
  print_success "Service account has proper permissions"
  return 0
}

check_pod_logs() {
  print_header "Checking Pod Logs"
  
  PODS=$(kubectl -n $NAMESPACE get pods -l app=k8s-playground,component=backend -o jsonpath='{.items[*].metadata.name}')
  
  if [ -z "$PODS" ]; then
    print_warning "No pods found"
    return 0
  fi
  
  for POD in $PODS; do
    print_info "Logs from pod: $POD"
    echo "    Last 20 lines:"
    kubectl -n $NAMESPACE logs $POD --tail=20 2>&1 | sed 's/^/      /'
    echo ""
  done
}

check_services() {
  print_header "Checking Services"
  
  if ! kubectl -n $NAMESPACE get service k8s-playground-backend &> /dev/null; then
    print_error "Service 'k8s-playground-backend' not found"
    echo "    FIX: Run './scripts/01-init-cluster.sh'"
    return 1
  fi
  
  print_success "Service exists"
  
  ClusterIP=$(kubectl -n $NAMESPACE get service k8s-playground-backend -o jsonpath='{.spec.clusterIP}')
  Port=$(kubectl -n $NAMESPACE get service k8s-playground-backend -o jsonpath='{.spec.ports[0].port}')
  
  echo "    ClusterIP: $ClusterIP"
  echo "    Port: $Port"
  
  # Test connectivity
  print_info "Testing service connectivity..."
  kubectl -n $NAMESPACE run -it --rm debug --image=curlimages/curl --restart=Never -- \
    curl -s http://$ClusterIP:$Port/api/health 2>&1 | head -20 || true
  
  return 0
}

generate_report() {
  print_header "Diagnostic Report"
  
  echo ""
  print_info "Environment:"
  echo "    Namespace: $NAMESPACE"
  echo "    Cluster: $(kubectl cluster-info | head -1 | cut -d' ' -f1-6)"
  echo "    kubectl version: $(kubectl version --short | grep Client | cut -d' ' -f3-)"
  
  echo ""
  print_info "Kubernetes Resources:"
  echo ""
  
  echo "    Namespaces:"
  kubectl get namespace $NAMESPACE -o wide 2>&1 | tail -1 | sed 's/^/      /'
  
  echo ""
  echo "    Deployments:"
  kubectl -n $NAMESPACE get deployments --no-headers 2>&1 | sed 's/^/      /'
  
  echo ""
  echo "    Pods:"
  kubectl -n $NAMESPACE get pods --no-headers 2>&1 | sed 's/^/      /'
  
  echo ""
  echo "    Services:"
  kubectl -n $NAMESPACE get services --no-headers 2>&1 | sed 's/^/      /'
  
  echo ""
  echo "    Secrets:"
  kubectl -n $NAMESPACE get secrets --no-headers 2>&1 | sed 's/^/      /'
}

main() {
  print_header "k8s-playground: CI/CD Troubleshooting"
  
  echo ""
  print_info "Running diagnostic checks..."
  echo ""
  
  STATUS=0
  
  check_namespace || STATUS=1
  echo ""
  
  check_service_account || STATUS=1
  echo ""
  
  check_deployment || STATUS=1
  echo ""
  
  check_image_pull || STATUS=1
  echo ""
  
  check_registry_credentials
  echo ""
  
  check_services || STATUS=1
  echo ""
  
  check_pod_logs || STATUS=1
  echo ""
  
  generate_report
  
  echo ""
  print_header "Troubleshooting Complete"
  
  if [ $STATUS -eq 0 ]; then
    print_success "All checks passed! CI/CD should be working."
  else
    print_error "Some issues were detected. See fixes above."
    exit 1
  fi
}

main "$@"
