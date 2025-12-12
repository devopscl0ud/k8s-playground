# k8s-Playground - Interactive Kubernetes Learning Platform

![Kubernetes Version](https://img.shields.io/badge/Kubernetes-1.31-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-purple)

## 🎯 About

**k8s-Playground** is an interactive, web-based learning platform for Kubernetes. Users can visualize real Kubernetes clusters, monitor resources, explore configurations, and learn interactively - all from a web browser.

### Key Features
- 🎮 **Real Cluster Visualization** - Connect to your actual Kubernetes cluster
- 📊 **Live Monitoring** - Real-time metrics and resource tracking
- 🔍 **Resource Explorer** - Browse nodes, pods, services, deployments
- 📚 **Interactive Learning** - Tutorial mode with hands-on exercises
- 🌐 **Browser-Based** - No kubectl or CLI knowledge required
- ✅ **Production Ready** - Secure, scalable, containerized

---

## 🚀 Quick Start

### For Users (Learning)
```bash
# Open playground in browser
http://your-backend-ip:3001
# or
http://your-frontend-ip:8000
```

### For Administrators (Setup)

**Option 1: Automated Setup (Recommended)**
```bash
# Run automated deployment script
chmod +x deploy-real-cluster.sh
./deploy-real-cluster.sh my-cluster vm 192.168.1.100

# Then follow prompts to deploy code
```

**Option 2: Manual Setup**
See [REAL_CLUSTER_SETUP.md](REAL_CLUSTER_SETUP.md) for detailed guide.

---

## 📋 Documentation

| Document | Purpose |
|----------|---------|
| [REAL_CLUSTER_SETUP.md](REAL_CLUSTER_SETUP.md) | Complete setup guide for real clusters |
| [CLUSTER_INTEGRATION_GUIDE.md](CLUSTER_INTEGRATION_GUIDE.md) | Technical integration details |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Testing & verification procedures |
| [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) | Local development setup |

---

## 🏗️ Architecture Overview

```
Browser (Users) → Frontend → Backend API → Kubernetes Cluster
                              ↓
                    Real-time Updates (WebSocket)
```

The backend connects to your Kubernetes cluster using a service account and kubeconfig, exposing REST APIs and WebSocket connections for real-time data.

---

## 🔧 Configuration

Quick setup with environment variables:

```bash
# Kubernetes Connection
KUBECONFIG=/path/to/kubeconfig
KUBE_API_URL=https://k8s-master:6443

# Server Config
PORT=3001
NODE_ENV=production

# Security
RATE_LIMIT_MAX=100
CORS_ORIGIN=*

# Features
ENABLE_REAL_CLUSTER=true
ENABLE_WEBSOCKET=true
```

See [.env.example](.env.example) for all options.

---

## 🧪 Quick Testing

```bash
# Check backend is running
curl http://localhost:3001/api/health

# Get cluster info
curl http://localhost:3001/api/cluster/info

# List nodes
curl http://localhost:3001/api/nodes

# List pods
curl http://localhost:3001/api/pods?namespace=default
```

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive tests.

---

## 📦 Project Structure

```
k8s-playground/
├── server-enhanced.js          # Enhanced backend (recommended)
├── frontend-integration.js      # Frontend-backend connector
├── main.js                      # Frontend logic
├── index.html                   # Main UI
├── kubernetes-deployment.yaml   # K8s manifests
├── deploy-real-cluster.sh       # Automation script
└── docs/
    ├── REAL_CLUSTER_SETUP.md
    ├── CLUSTER_INTEGRATION_GUIDE.md
    └── TESTING_GUIDE.md
```

---

## 🔒 Security

- ✅ Dedicated service account with limited RBAC
- ✅ Rate limiting (100 req/min)
- ✅ Network policies included
- ✅ Kubeconfig file protection
- ✅ CORS configuration
- ✅ TLS/HTTPS support

---

## 🚢 Deployment Options

### VM Deployment (Simple)
- Single Node.js process with PM2
- ~15 minutes setup
- Good for learning environments

### Kubernetes Deployment (Advanced)
- Full Helm-ready manifests
- Auto-scaling configured
- Health checks & monitoring
- Multi-replica deployment

---

## 📚 API Overview

### Health & Status
```
GET /api/health              # Server status
GET /api/health/cluster      # Cluster connectivity
GET /api/cluster/info        # Resource counts
```

### Resources
```
GET /api/nodes               # List nodes
GET /api/pods?namespace=     # List pods
GET /api/services?namespace= # List services
GET /api/deployments?ns=     # List deployments
GET /api/namespaces          # List namespaces
```

### WebSocket
```
WS /socket.io                # Real-time updates
```

---

## 💡 Use Cases

1. **Educational Institutions** - Teach Kubernetes concepts hands-on
2. **Enterprise Training** - Onboard new DevOps engineers
3. **Cluster Visualization** - Monitor team's production clusters
4. **Learning Labs** - Interactive Kubernetes exercises
5. **Demo Environments** - Show cluster to stakeholders

---

## 🔄 Update from Old Server to Enhanced

The enhanced server (`server-enhanced.js`) includes:
- Better error handling
- Improved logging
- Multiple kubeconfig loading methods
- Health check endpoints
- Pod logs viewer
- Better cluster details

**Migration:**
```bash
cp server.js server-old.js
cp server-enhanced.js server.js
npm start
```

---

## 🛠️ Technology Stack

**Frontend:** HTML5, CSS3, JavaScript, Socket.IO
**Backend:** Node.js, Express.js, @kubernetes/client-node
**Infrastructure:** Docker, Kubernetes, PM2

---

## ❓ Common Issues

**Backend can't connect to cluster?**
→ Check [TESTING_GUIDE.md](TESTING_GUIDE.md) troubleshooting section

**Frontend not loading data?**
→ Verify CORS_ORIGIN in .env matches frontend domain

**WebSocket connection fails?**
→ Check firewall allows WebSocket connections

---

## 📖 Next Steps

1. ✅ Read [REAL_CLUSTER_SETUP.md](REAL_CLUSTER_SETUP.md)
2. ✅ Run setup script or follow manual guide
3. ✅ Test using [TESTING_GUIDE.md](TESTING_GUIDE.md)
4. ✅ Configure frontend with backend URL
5. ✅ Share with your team!

---

## 🤝 Contributing

Areas for improvement:
- More Kubernetes resource types
- Enhanced visualizations
- Learning challenges
- Performance optimization
- Test coverage

---

## 📝 License

MIT License - See LICENSE file

---

**Start learning Kubernetes with real clusters today! 🚀**