#!/bin/bash

# k8s-Playground Deployment Script
# Automates the setup of backend and frontend for real Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="k8s-playground-backend"
SERVICE_ACCOUNT="k8s-playground-admin"
CLUSTER_NAME="${1:-k8s-playground}"
BACKEND_DEPLOY_METHOD="${2:-vm}"  # vm or kubernetes
BACKEND_VM_IP="${3:-}"

# Functions
print_header() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    print_success "kubectl is installed"
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    print_success "Connected to Kubernetes cluster"
}

# Create service account
create_service_account() {
    print_header "Creating Service Account"
    
    print_info "Creating namespace: $NAMESPACE"
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    print_success "Namespace created/updated"
    
    print_info "Creating service account: $SERVICE_ACCOUNT"
    kubectl create serviceaccount $SERVICE_ACCOUNT -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    print_success "Service account created/updated"
    
    print_info "Creating cluster role binding"
    kubectl create clusterrolebinding $SERVICE_ACCOUNT \
        --clusterrole=cluster-admin \
        --serviceaccount=$NAMESPACE:$SERVICE_ACCOUNT \
        --dry-run=client -o yaml | kubectl apply -f -
    print_success "Cluster role binding created/updated"
}

# Extract credentials
extract_credentials() {
    print_header "Extracting Credentials"
    
    # Get secret name
    SECRET_NAME=$(kubectl get secret -n $NAMESPACE \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$SECRET_NAME" ]; then
        print_warning "Waiting for secret to be created..."
        sleep 5
        SECRET_NAME=$(kubectl get secret -n $NAMESPACE \
            -o jsonpath='{.items[0].metadata.name}')
    fi
    
    print_info "Secret name: $SECRET_NAME"
    
    # Extract token
    TOKEN=$(kubectl get secret $SECRET_NAME -n $NAMESPACE \
        -o jsonpath='{.data.token}' | base64 -d)
    print_success "Token extracted"
    
    # Extract CA certificate
    CA_CERT=$(kubectl get secret $SECRET_NAME -n $NAMESPACE \
        -o jsonpath='{.data.ca\.crt}' | base64 -d)
    print_success "CA certificate extracted"
    
    # Get API server
    API_SERVER=$(kubectl cluster-info | grep 'Kubernetes master' | awk -F' ' '{print $NF}')
    print_info "API Server: $API_SERVER"
}

# Create kubeconfig
create_kubeconfig() {
    print_header "Creating Kubeconfig"
    
    # Create temporary kubeconfig
    KUBECONFIG_FILE="/tmp/kubeconfig-playground"
    
    # Encode CA cert as base64
    CA_CERT_B64=$(echo -n "$CA_CERT" | base64 -w 0)
    
    cat > $KUBECONFIG_FILE << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: $CA_CERT_B64
    server: $API_SERVER
  name: $CLUSTER_NAME
contexts:
- context:
    cluster: $CLUSTER_NAME
    user: $SERVICE_ACCOUNT
  name: $CLUSTER_NAME
current-context: $CLUSTER_NAME
users:
- name: $SERVICE_ACCOUNT
  user:
    token: $TOKEN
EOF
    
    print_success "Kubeconfig created at: $KUBECONFIG_FILE"
    
    # Verify kubeconfig
    print_info "Verifying kubeconfig..."
    if KUBECONFIG=$KUBECONFIG_FILE kubectl cluster-info &> /dev/null; then
        print_success "Kubeconfig verified"
    else
        print_error "Kubeconfig verification failed"
        exit 1
    fi
}

# Deploy backend on VM
deploy_backend_vm() {
    print_header "Deploying Backend on VM"
    
    if [ -z "$BACKEND_VM_IP" ]; then
        print_error "Backend VM IP not provided"
        echo "Usage: $0 <cluster-name> vm <backend-vm-ip>"
        exit 1
    fi
    
    print_info "Backend VM IP: $BACKEND_VM_IP"
    
    # Check if VM is accessible
    if ! ping -c 1 $BACKEND_VM_IP &> /dev/null; then
        print_warning "Cannot ping backend VM. Make sure it's accessible."
    fi
    
    print_info "Preparing backend deployment script..."
    
    # Create deployment script
    DEPLOY_SCRIPT="/tmp/deploy-backend.sh"
    cat > $DEPLOY_SCRIPT << 'SCRIPT_EOF'
#!/bin/bash

set -e

echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

echo "Creating app directory..."
mkdir -p /opt/k8s-playground
cd /opt/k8s-playground

echo "Installing PM2..."
npm install -g pm2

echo "Creating kubeconfig directory..."
mkdir -p /etc/k8s-playground

echo "Installation complete. Ready for app deployment."
SCRIPT_EOF
    
    chmod +x $DEPLOY_SCRIPT
    
    print_info "Sending kubeconfig to VM..."
    scp /tmp/kubeconfig-playground root@$BACKEND_VM_IP:/etc/k8s-playground/kubeconfig
    
    print_info "Sending deployment script to VM..."
    scp $DEPLOY_SCRIPT root@$BACKEND_VM_IP:/tmp/deploy-backend.sh
    
    print_info "Running deployment script on VM..."
    ssh root@$BACKEND_VM_IP "bash /tmp/deploy-backend.sh"
    
    print_success "Backend VM prepared. You can now deploy your code."
    print_info "Next steps:"
    echo "  1. Copy your code to /opt/k8s-playground on the VM"
    echo "  2. Create .env file with required configuration"
    echo "  3. Run: pm2 start npm --name k8s-playground-backend -- start"
    echo "  4. Test: curl http://$BACKEND_VM_IP:3001/api/health"
}

# Deploy backend in Kubernetes
deploy_backend_kubernetes() {
    print_header "Deploying Backend in Kubernetes"
    
    # Create ConfigMap
    print_info "Creating ConfigMap..."
    kubectl apply -f - << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: k8s-playground-config
  namespace: k8s-playground
data:
  PORT: "3001"
  NODE_ENV: "production"
  RATE_LIMIT_WINDOW: "60000"
  RATE_LIMIT_MAX: "100"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "*"
EOF
    print_success "ConfigMap created"
    
    # Note: Full deployment requires Docker image
    print_info "Note: Full Kubernetes deployment requires Docker image."
    print_info "See kubernetes-deployment.yaml for complete manifest."
    print_warning "Please build and push Docker image before applying full deployment"
}

# Generate summary
generate_summary() {
    print_header "Deployment Summary"
    
    echo ""
    echo "Service Account: $SERVICE_ACCOUNT"
    echo "Namespace: $NAMESPACE"
    echo "Cluster: $CLUSTER_NAME"
    echo "API Server: $API_SERVER"
    echo "Kubeconfig: /tmp/kubeconfig-playground"
    echo ""
    
    if [ "$BACKEND_DEPLOY_METHOD" = "vm" ]; then
        echo "Backend VM IP: $BACKEND_VM_IP"
        echo "Backend Status: Ready for deployment"
    else
        echo "Backend Method: Kubernetes"
        echo "Backend Status: ConfigMap created, image deployment pending"
    fi
    
    echo ""
    print_success "Pre-deployment configuration complete!"
    echo ""
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [CLUSTER_NAME] [DEPLOY_METHOD] [VM_IP]

Arguments:
  CLUSTER_NAME    - Name of your Kubernetes cluster (default: k8s-playground)
  DEPLOY_METHOD   - How to deploy backend: 'vm' or 'kubernetes' (default: vm)
  VM_IP          - IP address of backend VM (required if DEPLOY_METHOD=vm)

Examples:
  $0
  $0 my-cluster vm 192.168.1.100
  $0 my-cluster kubernetes

This script will:
  1. Create necessary Kubernetes resources
  2. Extract credentials for cluster access
  3. Create kubeconfig file
  4. Prepare backend for deployment
EOF
}

# Main execution
main() {
    print_header "k8s-Playground Deployment Assistant"
    
    check_prerequisites
    create_service_account
    extract_credentials
    create_kubeconfig
    
    if [ "$BACKEND_DEPLOY_METHOD" = "vm" ]; then
        deploy_backend_vm
    else
        deploy_backend_kubernetes
    fi
    
    generate_summary
}

# Handle help request
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Run main
main
