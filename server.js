const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const k8s = require('@kubernetes/client-node');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Kubernetes client setup
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100;

function checkRateLimit(clientId) {
  const now = Date.now();
  const clientLimit = rateLimit.get(clientId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > clientLimit.resetTime) {
    clientLimit.count = 0;
    clientLimit.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  clientLimit.count++;
  rateLimit.set(clientId, clientLimit);
  
  return clientLimit.count <= RATE_LIMIT_MAX;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/cluster/info', async (req, res) => {
  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const [nodes, pods, services, deployments] = await Promise.allSettled([
      k8sApi.listNode(),
      k8sApi.listPodForAllNamespaces(),
      k8sApi.listServiceForAllNamespaces(),
      k8sAppsApi.listDeploymentForAllNamespaces()
    ]);

    const clusterInfo = {
      nodes: nodes.status === 'fulfilled' ? nodes.value.body.items.length : 0,
      pods: pods.status === 'fulfilled' ? pods.value.body.items.length : 0,
      services: services.status === 'fulfilled' ? services.value.body.items.length : 0,
      deployments: deployments.status === 'fulfilled' ? deployments.value.body.items.length : 0,
      timestamp: new Date().toISOString()
    };

    res.json(clusterInfo);
  } catch (error) {
    console.error('Error getting cluster info:', error);
    res.status(500).json({ error: 'Failed to get cluster information' });
  }
});

app.get('/api/nodes', async (req, res) => {
  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const response = await k8sApi.listNode();
    const nodes = response.body.items.map(node => ({
      name: node.metadata.name,
      status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
      cpu: node.status.capacity?.cpu || 'Unknown',
      memory: node.status.capacity?.memory || 'Unknown',
      os: node.status.nodeInfo?.osImage || 'Unknown',
      kubeletVersion: node.status.nodeInfo?.kubeletVersion || 'Unknown',
      creationTimestamp: node.metadata.creationTimestamp
    }));

    res.json(nodes);
  } catch (error) {
    console.error('Error getting nodes:', error);
    res.status(500).json({ error: 'Failed to get nodes' });
  }
});

app.get('/api/pods', async (req, res) => {
  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const namespace = req.query.namespace || 'default';
    const response = await k8sApi.listNamespacedPod(namespace);
    
    const pods = response.body.items.map(pod => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      status: pod.status.phase,
      nodeName: pod.spec.nodeName,
      containers: pod.spec.containers.map(c => ({
        name: c.name,
        image: c.image,
        ports: c.ports || []
      })),
      creationTimestamp: pod.metadata.creationTimestamp,
      labels: pod.metadata.labels || {}
    }));

    res.json(pods);
  } catch (error) {
    console.error('Error getting pods:', error);
    res.status(500).json({ error: 'Failed to get pods' });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const namespace = req.query.namespace || 'default';
    const response = await k8sApi.listNamespacedService(namespace);
    
    const services = response.body.items.map(service => ({
      name: service.metadata.name,
      namespace: service.metadata.namespace,
      type: service.spec.type,
      clusterIP: service.spec.clusterIP,
      externalIPs: service.spec.externalIPs || [],
      ports: service.spec.ports || [],
      selector: service.spec.selector || {},
      creationTimestamp: service.metadata.creationTimestamp
    }));

    res.json(services);
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

app.get('/api/deployments', async (req, res) => {
  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const namespace = req.query.namespace || 'default';
    const response = await k8sAppsApi.listNamespacedDeployment(namespace);
    
    const deployments = response.body.items.map(deployment => ({
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      replicas: deployment.spec.replicas,
      readyReplicas: deployment.status.readyReplicas || 0,
      availableReplicas: deployment.status.availableReplicas || 0,
      containers: deployment.spec.template.spec.containers.map(c => ({
        name: c.name,
        image: c.image
      })),
      creationTimestamp: deployment.metadata.creationTimestamp,
      labels: deployment.metadata.labels || {}
    }));

    res.json(deployments);
  } catch (error) {
    console.error('Error getting deployments:', error);
    res.status(500).json({ error: 'Failed to get deployments' });
  }
});

app.get('/api/namespaces', async (req, res) => {
  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const response = await k8sApi.listNamespace();
    const namespaces = response.body.items.map(ns => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      creationTimestamp: ns.metadata.creationTimestamp
    }));

    res.json(namespaces);
  } catch (error) {
    console.error('Error getting namespaces:', error);
    res.status(500).json({ error: 'Failed to get namespaces' });
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial cluster state
  sendClusterUpdate(socket);
  
  // Set up periodic updates
  const updateInterval = setInterval(() => {
    sendClusterUpdate(socket);
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(updateInterval);
  });
  
  socket.on('subscribe-namespace', (namespace) => {
    socket.join(`namespace-${namespace}`);
    console.log(`Client ${socket.id} subscribed to namespace ${namespace}`);
  });
  
  socket.on('unsubscribe-namespace', (namespace) => {
    socket.leave(`namespace-${namespace}`);
    console.log(`Client ${socket.id} unsubscribed from namespace ${namespace}`);
  });
});

async function sendClusterUpdate(socket) {
  try {
    const [nodes, pods, services, deployments] = await Promise.allSettled([
      k8sApi.listNode(),
      k8sApi.listPodForAllNamespaces(),
      k8sApi.listServiceForAllNamespaces(),
      k8sAppsApi.listDeploymentForAllNamespaces()
    ]);

    const clusterData = {
      nodes: nodes.status === 'fulfilled' ? nodes.value.body.items.map(node => ({
        name: node.metadata.name,
        status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
        cpu: node.status.capacity?.cpu || 'Unknown',
        memory: node.status.capacity?.memory || 'Unknown',
        os: node.status.nodeInfo?.osImage || 'Unknown'
      })) : [],
      pods: pods.status === 'fulfilled' ? pods.value.body.items.length : 0,
      services: services.status === 'fulfilled' ? services.value.body.items.length : 0,
      deployments: deployments.status === 'fulfilled' ? deployments.value.body.items.length : 0,
      timestamp: new Date().toISOString()
    };

    socket.emit('cluster-update', clusterData);
  } catch (error) {
    console.error('Error sending cluster update:', error);
  }
}

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Kubernetes Playground Backend running on port ${PORT}`);
  console.log('Connected to cluster:', kc.getCurrentContext());
});

module.exports = app;