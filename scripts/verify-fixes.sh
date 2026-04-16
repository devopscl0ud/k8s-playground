#!/bin/bash

# ============================================================================
# Quick Verification Script
# ============================================================================
# Verifies that all CI/CD fixes are properly applied

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

verify_files() {
  print_header "Verifying Files"
  
  files=(
    "Jenkinsfile"
    "kubernetes-deployment.yaml"
    "scripts/01-init-cluster.sh"
    "scripts/02-troubleshoot-cicd.sh"
    "CICD_TROUBLESHOOTING.md"
    "CICD_FIXES_SUMMARY.md"
  )
  
  for file in "${files[@]}"; do
    if [ -f "$file" ]; then
      print_success "$file exists"
    else
      print_error "$file missing"
      return 1
    fi
  done
}

verify_jenkinsfile() {
  print_header "Verifying Jenkinsfile"
  
  # Check for key stages
  stages=(
    "Checkout"
    "Install & Test"
    "Validate Deployment Prerequisites"
    "Build & Push Image"
    "Deploy to Kubernetes"
  )
  
  for stage in "${stages[@]}"; do
    if grep -q "stage('$stage')" Jenkinsfile; then
      print_success "Stage found: $stage"
    else
      print_error "Stage missing: $stage"
      return 1
    fi
  done
  
  # Check for key features
  features=(
    "kubeconfig-credentials"
    "docker-hub-creds"
    "create namespace"
    "DEPLOYMENT_EXISTS"
    "apply -f kubernetes-deployment.yaml"
    "set image"
    "rollout status"
  )
  
  for feature in "${features[@]}"; do
    if grep -q "$feature" Jenkinsfile; then
      print_success "Feature found: $feature"
    else
      print_error "Feature missing: $feature"
      return 1
    fi
  done
}

verify_scripts() {
  print_header "Verifying Scripts"
  
  if [ -x scripts/01-init-cluster.sh ]; then
    print_success "01-init-cluster.sh is executable"
  else
    print_error "01-init-cluster.sh is not executable"
    return 1
  fi
  
  if [ -x scripts/02-troubleshoot-cicd.sh ]; then
    print_success "02-troubleshoot-cicd.sh is executable"
  else
    print_error "02-troubleshoot-cicd.sh is not executable"
    return 1
  fi
}

main() {
  print_header "CI/CD Fixes Verification"
  
  echo ""
  verify_files && echo "" || { echo ""; return 1; }
  verify_jenkinsfile && echo "" || { echo ""; return 1; }
  verify_scripts && echo "" || { echo ""; return 1; }
  
  print_header "✅ All Verifications Passed!"
  echo ""
  echo "Next steps:"
  echo "1. Run: ./scripts/01-init-cluster.sh your_docker_username your_docker_pat"
  echo "2. Add credentials to Jenkins (follow script instructions)"
  echo "3. Create Jenkins pipeline job pointing to this repo's Jenkinsfile"
  echo "4. If issues: Run ./scripts/02-troubleshoot-cicd.sh"
  echo ""
  echo "📖 For detailed information, see CICD_FIXES_SUMMARY.md"
  echo ""
}

main "$@"
