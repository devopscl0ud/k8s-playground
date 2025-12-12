#!/bin/bash

# k8s-Playground Integration Checklist
# Use this to track your setup progress

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     k8s-Playground Real Cluster Integration Checklist        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track progress
COMPLETED=0
TOTAL=0

# Helper functions
check_task() {
    local task=$1
    local optional=${2:-false}
    
    ((TOTAL++))
    echo -n "[ ] $task"
    
    if [ "$optional" = "true" ]; then
        echo " (optional)"
    else
        echo ""
    fi
}

check_complete() {
    ((COMPLETED++))
}

# Phase 1: Preparation
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 1: Preparation & Documentation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_task "1. Read INTEGRATION_SUMMARY.md"
check_task "2. Read REAL_CLUSTER_SETUP.md"
check_task "3. Understand your cluster info (k8s-master:6443)"
check_task "4. Review CLUSTER_INTEGRATION_GUIDE.md"
check_task "5. Review TESTING_GUIDE.md"

echo ""
echo "Progress: $COMPLETED/$TOTAL"
echo ""
echo "Actions needed:"
echo "  1. Read the documentation files above"
echo "  2. Understand your cluster topology"
echo "  3. Plan your deployment strategy (VM or K8s)"
echo ""
read -p "Press ENTER to continue..."

# Phase 2: Cluster Preparation
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 2: Kubernetes Cluster Preparation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_task "6. SSH to k8s-master as k8sadmin"
check_task "7. Create k8s-playground-backend namespace"
check_task "8. Create k8s-playground-admin service account"
check_task "9. Create cluster role binding"
check_task "10. Extract service account token"
check_task "11. Extract CA certificate"
check_task "12. Create kubeconfig-playground file"
check_task "13. Test kubeconfig connectivity"

echo ""
echo "Progress: $COMPLETED/$TOTAL"
echo ""
echo "Quick start (run on k8s-master):"
echo ""
echo "  kubectl create namespace k8s-playground-backend"
echo "  kubectl create serviceaccount k8s-playground-admin -n k8s-playground-backend"
echo "  kubectl create clusterrolebinding k8s-playground-admin \\"
echo "    --clusterrole=cluster-admin \\"
echo "    --serviceaccount=k8s-playground-backend:k8s-playground-admin"
echo ""
echo "See REAL_CLUSTER_SETUP.md PHASE 1 for full instructions."
echo ""
read -p "Press ENTER after completing cluster setup..."

# Phase 3: Backend Deployment
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 3: Backend Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "Choose deployment method:"
echo "  1. VM (simpler, ~15 minutes)"
echo "  2. Kubernetes (scalable, production-ready)"
echo ""
read -p "Enter your choice (1 or 2): " deploy_method

case $deploy_method in
    1)
        echo ""
        echo "VM Deployment Setup:"
        check_task "14. Prepare backend VM (install Node.js, PM2)"
        check_task "15. Copy kubeconfig to /etc/k8s-playground/"
        check_task "16. Copy application code to /opt/k8s-playground"
        check_task "17. Create .env file with configuration"
        check_task "18. Install dependencies (npm ci)"
        check_task "19. Start backend with PM2"
        check_task "20. Verify backend health (curl :3001/api/health)"
        ;;
    2)
        echo ""
        echo "Kubernetes Deployment Setup:"
        check_task "14. Build Docker image (optional)"
        check_task "15. Create kubeconfig secret"
        check_task "16. Apply kubernetes-deployment.yaml"
        check_task "17. Wait for pods to be ready"
        check_task "18. Port forward for testing"
        check_task "19. Verify backend health"
        ;;
esac

echo ""
echo "Progress: $COMPLETED/$TOTAL"
echo ""
echo "See REAL_CLUSTER_SETUP.md PHASE 2 for detailed instructions."
echo ""
read -p "Press ENTER after deploying backend..."

# Phase 4: Testing
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 4: Testing & Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_task "21. Test /api/health endpoint"
check_task "22. Test /api/cluster/info endpoint"
check_task "23. Test /api/nodes endpoint"
check_task "24. Test /api/pods endpoint"
check_task "25. Test /api/services endpoint"
check_task "26. Test /api/deployments endpoint"
check_task "27. Test /api/namespaces endpoint"
check_task "28. Test WebSocket connection"

echo ""
echo "Progress: $COMPLETED/$TOTAL"
echo ""
echo "Run tests from: ./test-playground.sh (from TESTING_GUIDE.md)"
echo ""
read -p "Press ENTER after running all tests..."

# Phase 5: Frontend Setup
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 5: Frontend Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_task "29. Update BACKEND_URL in frontend-integration.js"
check_task "30. Update socket.io script source in index.html"
check_task "31. Configure CORS_ORIGIN in backend .env"
check_task "32. Copy frontend files to web server"
check_task "33. Test frontend loads in browser"
check_task "34. Verify cluster data displays"

echo ""
echo "Progress: $COMPLETED/$TOTAL"
echo ""
read -p "Press ENTER after frontend setup..."

# Phase 6: Production Hardening
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 6: Production Hardening (Optional)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_task "35. Enable HTTPS/TLS" true
check_task "36. Set up authentication/API keys" true
check_task "37. Configure monitoring (Prometheus)" true
check_task "38. Set up logging aggregation" true
check_task "39. Enable network policies" true
check_task "40. Configure backups" true

echo ""
echo "Progress: $COMPLETED/$TOTAL"
echo ""
echo "See REAL_CLUSTER_SETUP.md PHASE 5 for details."
echo ""

# Phase 7: User Access
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PHASE 7: User Access & Documentation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_task "41. Share frontend URL with users"
check_task "42. Create user documentation"
check_task "43. Set up support channel (email/slack)"
check_task "44. Monitor backend logs"
check_task "45. Gather user feedback"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✓ All phases documented!${NC}"
echo ""
echo "You now have:"
echo "  ✓ Enhanced backend server (server-enhanced.js)"
echo "  ✓ Kubernetes deployment manifests"
echo "  ✓ Automated setup script (deploy-real-cluster.sh)"
echo "  ✓ Comprehensive guides and documentation"
echo "  ✓ Testing suite"
echo ""
echo "Next steps:"
echo "  1. Follow REAL_CLUSTER_SETUP.md step by step"
echo "  2. Or run: bash deploy-real-cluster.sh my-cluster vm <vm-ip>"
echo "  3. Test using guidelines in TESTING_GUIDE.md"
echo "  4. Share with your team!"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
