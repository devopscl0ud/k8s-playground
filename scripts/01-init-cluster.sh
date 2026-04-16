#!/bin/bash

# ============================================================================
# k8s-playground: Initial Cluster Setup Script
# ============================================================================
# This script performs the one-time setup of Kubernetes resources needed
# for the CI/CD pipeline to work. Run this BEFORE configuring Jenkins.
#
# Prerequisites:
# - kubectl installed and configured
# - Access to a Kubernetes cluster
# - docker-hub credentials (username and PAT token)
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="k8s-playground"
SERVICE_ACCOUNT="k8s-playground-admin"
DOCKER_USERNAME="${1:-}"
DOCKER_PASSWORD="${2:-}"

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
  exit 1
}

check_prerequisites() {
  print_header "Checking Prerequisites"
  
  if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl first."
  fi
  print_success "kubectl is installed"
  
  if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster. Run 'kubectl cluster-info' to debug."
  fi
  print_success "Connected to Kubernetes cluster"
  
  CLUSTER_INFO=$(kubectl cluster-info | head -1)
  print_info "Cluster: $CLUSTER_INFO"
}

create_namespace() {
  print_header "Step 1: Creating Namespace"
  
  print_info "Creating namespace: $NAMESPACE"
  kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
  print_success "Namespace '$NAMESPACE' is ready"
}

create_service_account() {
  print_header "Step 2: Creating Service Account"
  
  print_info "Creating service account: $SERVICE_ACCOUNT"
  kubectl create serviceaccount $SERVICE_ACCOUNT \
    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
  print_success "Service account created"
  
  print_info "Creating cluster role binding for admin access"
  kubectl create clusterrolebinding ${NAMESPACE}-${SERVICE_ACCOUNT} \
    --clusterrole=cluster-admin \
    --serviceaccount=$NAMESPACE:$SERVICE_ACCOUNT \
    --dry-run=client -o yaml | kubectl apply -f -
  print_success "Cluster role binding created"
}

deploy_kubernetes_resources() {
  print_header "Step 3: Deploying Kubernetes Resources"
  
  print_info "Applying kubernetes-deployment.yaml..."
  if [ ! -f "kubernetes-deployment.yaml" ]; then
    print_error "kubernetes-deployment.yaml not found in current directory"
  fi
  
  kubectl apply -f kubernetes-deployment.yaml
  print_success "Kubernetes resources deployed"
  
  print_info "Waiting for resources to be created..."
  sleep 3
  
  echo ""
  print_info "Created resources:"
  kubectl -n $NAMESPACE get all
}

create_registry_secret() {
  print_header "Step 4: Creating Docker Registry Secret"
  
  if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
    print_warning "Docker credentials not provided. Skipping registry secret creation."
    echo ""
    print_info "To create the registry secret manually later, run:"
    echo "  kubectl create secret docker-registry registry-credentials \\"
    echo "    --docker-server=https://index.docker.io/v1/ \\"
    echo "    --docker-username=YOUR_USERNAME \\"
    echo "    --docker-password=YOUR_PAT_TOKEN \\"
    echo "    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -"
    return
  fi
  
  print_info "Creating docker registry secret..."
  kubectl create secret docker-registry registry-credentials \
    --docker-server=https://index.docker.io/v1/ \
    --docker-username="$DOCKER_USERNAME" \
    --docker-password="$DOCKER_PASSWORD" \
    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
  print_success "Docker registry secret created"
}

verify_deployment() {
  print_header "Step 5: Verifying Deployment"
  
  print_info "Checking deployment status..."
  
  DEPLOYMENT_EXISTS=$(kubectl -n $NAMESPACE get deployment k8s-playground-backend --no-headers 2>/dev/null | wc -l)
  
  if [ $DEPLOYMENT_EXISTS -eq 0 ]; then
    print_error "Deployment k8s-playground-backend not found"
  fi
  
  print_success "Deployment k8s-playground-backend exists"
  
  echo ""
  print_info "Deployment status:"
  kubectl -n $NAMESPACE describe deployment k8s-playground-backend | grep -A 5 "Status:"
  
  echo ""
  print_info "Pods:"
  kubectl -n $NAMESPACE get pods -l app=k8s-playground,component=backend
}

extract_kubeconfig_for_jenkins() {
  print_header "Step 6: Extracting Kubeconfig for Jenkins"
  
  print_info "Getting service account credentials..."
  
  # Get the current context and cluster
  CURRENT_CONTEXT=$(kubectl config current-context)
  CLUSTER_INFO=$(kubectl config view --raw --minify --flatten -o jsonpath='{.clusters[0].cluster}')
  
  # Get the service account token and CA
  SECRET_NAME=$(kubectl get secret -n $NAMESPACE \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  
  if [ -z "$SECRET_NAME" ]; then
    print_warning "Service account secret not yet created. Waiting..."
    sleep 5
    SECRET_NAME=$(kubectl get secret -n $NAMESPACE \
      -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  fi
  
  TOKEN=$(kubectl get secret $SECRET_NAME -n $NAMESPACE \
    -o jsonpath='{.data.token}' | base64 -d)
  
  CA_CERT=$(kubectl get secret $SECRET_NAME -n $NAMESPACE \
    -o jsonpath='{.data.ca\.crt}')
  
  # Get the API server URL
  API_SERVER=$(kubectl config view --raw --minify --flatten -o jsonpath='{.clusters[0].cluster.server}')
  
  # Create kubeconfig for Jenkins
  KUBECONFIG_FILE="/tmp/kubeconfig-jenkins-$(date +%s).yaml"
  
  cat > "$KUBECONFIG_FILE" << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: $CA_CERT
    server: $API_SERVER
  name: k8s-playground
contexts:
- context:
    cluster: k8s-playground
    namespace: $NAMESPACE
    user: k8s-playground-admin
  name: k8s-playground
current-context: k8s-playground
users:
- name: k8s-playground-admin
  user:
    token: $TOKEN
EOF
  
  print_success "Kubeconfig created: $KUBECONFIG_FILE"
  echo ""
  print_info "📋 NEXT STEPS FOR JENKINS SETUP:"
  echo "  1. Open Jenkins UI"
  echo "  2. Go to: Manage Jenkins → Manage Credentials → System → Global credentials"
  echo "  3. Click 'Add Credentials'"
  echo "  4. Select 'Secret file' as the credential type"
  echo "  5. Upload this file: $KUBECONFIG_FILE"
  echo "  6. Set ID to: kubeconfig-credentials"
  echo "  7. Click 'Create'"
  echo ""
  print_info "After uploading, you can safely delete: $KUBECONFIG_FILE"
}

setup_docker_credentials_in_jenkins() {
  print_header "Step 7: Docker Credentials Setup Instructions"
  
  echo ""
  print_info "📋 DOCKER HUB CREDENTIALS FOR JENKINS:"
  echo "  1. Go to Jenkins: Manage Jenkins → Manage Credentials → System → Global credentials"
  echo "  2. Click 'Add Credentials'"
  echo "  3. Select 'Username with password' as the type"
  echo "  4. Username: your Docker Hub username"
  echo "  5. Password: your Docker Hub Personal Access Token (PAT)"
  echo "     (Get this from: https://hub.docker.com/settings/security)"
  echo "  6. Set ID to: docker-hub-creds"
  echo "  7. Click 'Create'"
  echo ""
}

summary() {
  print_header "Setup Complete! ✅"
  
  echo ""
  print_success "Kubernetes cluster is ready for CI/CD!"
  echo ""
  print_info "Summary of created resources:"
  echo "  • Namespace: $NAMESPACE"
  echo "  • Service Account: $SERVICE_ACCOUNT"
  echo "  • Deployment: k8s-playground-backend"
  echo "  • Service: k8s-playground-backend"
  echo "  • ConfigMap: k8s-playground-config"
  echo "  • HPA: k8s-playground-backend"
  echo "  • NetworkPolicy: k8s-playground-network-policy"
  echo ""
  print_info "Next steps:"
  echo "  1. Add kubeconfig-credentials to Jenkins (see above)"
  echo "  2. Add docker-hub-creds to Jenkins (see above)"
  echo "  3. Create a Pipeline job in Jenkins using the Jenkinsfile"
  echo "  4. Configure GitHub webhook to trigger builds"
  echo ""
  print_info "To verify deployment later, run:"
  echo "  kubectl -n $NAMESPACE get all"
  echo "  kubectl -n $NAMESPACE logs -l app=k8s-playground"
}

# Main execution
main() {
  print_header "k8s-playground: Initial Cluster Setup"
  
  check_prerequisites
  create_namespace
  create_service_account
  deploy_kubernetes_resources
  create_registry_secret
  verify_deployment
  extract_kubeconfig_for_jenkins
  setup_docker_credentials_in_jenkins
  summary
}

main "$@"
