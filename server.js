const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Logging utility
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// Kubernetes client setup with multiple options
let kc = null;
let k8sApi = null;
let k8sAppsApi = null;
let k8sBatchApi = null;
let clusterConnected = false;
let mockMode = process.env.MOCK_MODE === 'true' || process.env.KUBECONFIG === 'mock';

// Mock data for testing
const mockClusterData = {
  nodes: [
    { name: 'k8s-master', status: 'Ready', ready: true, roles: ['control-plane'], cpu: '4', memory: '8Gi', os: 'Ubuntu 20.04', version: '1.32.10' },
    { name: 'k8s-worker1', status: 'Ready', ready: true, roles: ['worker'], cpu: '4', memory: '8Gi', os: 'Ubuntu 20.04', version: '1.31.14' },
    { name: 'k8s-worker2', status: 'Ready', ready: true, roles: ['worker'], cpu: '4', memory: '8Gi', os: 'Ubuntu 20.04', version: '1.31.14' }
  ],
  pods: [
    { name: 'coredns-787d4945fb-abc12', namespace: 'kube-system', status: 'Running', nodeName: 'k8s-master' },
    { name: 'etcd-k8s-master', namespace: 'kube-system', status: 'Running', nodeName: 'k8s-master' },
    { name: 'kube-apiserver-k8s-master', namespace: 'kube-system', status: 'Running', nodeName: 'k8s-master' },
    { name: 'nginx-deployment-66b6c48dd5-abc12', namespace: 'default', status: 'Running', nodeName: 'k8s-worker1' }
  ],
  services: [
    { name: 'kubernetes', namespace: 'default', type: 'ClusterIP', clusterIP: '10.96.0.1' },
    { name: 'nginx-service', namespace: 'default', type: 'NodePort', clusterIP: '10.96.0.50' }
  ],
  deployments: [
    { name: 'nginx-deployment', namespace: 'default', replicas: 2, readyReplicas: 2, availableReplicas: 2 }
  ]
};

async function initializeKubernetesClient() {
  try {
    if (mockMode) {
      logger.info('✓ Mock mode enabled - using simulated cluster data');
      clusterConnected = true;
      return true;
    }

    kc = new k8s.KubeConfig();
    
    // Try different loading methods
    const loadSuccess = await tryLoadKubernetesConfig();
    
    if (!loadSuccess) {
      throw new Error('Failed to load Kubernetes configuration');
    }

    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

    // Test connection
    await testClusterConnection();
    clusterConnected = true;
    
    logger.info(`✓ Kubernetes client initialized. Context: ${kc.getCurrentContext()}`);
    logger.info(`✓ Connected to cluster. API Server: ${kc.getCurrentCluster()?.server}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Kubernetes client', error);
    logger.info('Run with MOCK_MODE=true to use simulated cluster data');
    clusterConnected = false;
    return false;
  }
}

async function tryLoadKubernetesConfig() {
  // Method 1: Try kubeconfig file path from environment
  if (process.env.KUBECONFIG) {
    try {
      logger.info(`Attempting to load kubeconfig from: ${process.env.KUBECONFIG}`);
      kc.loadFromFile(process.env.KUBECONFIG);
      return true;
    } catch (error) {
      logger.warn(`Failed to load from KUBECONFIG path: ${error.message}`);
    }
  }

  // Method 2: Try default kubeconfig locations
  const defaultPaths = [
    path.join(process.env.HOME || '/root', '.kube/config'),
    '/etc/k8s-playground/kubeconfig',
    '/var/run/secrets/kubernetes.io/serviceaccount/token'
  ];

  for (const kubeconfigPath of defaultPaths) {
    try {
      if (fs.existsSync(kubeconfigPath)) {
        logger.info(`Found kubeconfig at: ${kubeconfigPath}`);
        kc.loadFromFile(kubeconfigPath);
        return true;
      }
    } catch (error) {
      logger.warn(`Failed to load from ${kubeconfigPath}`);
    }
  }

  // Method 3: Try in-cluster configuration
  try {
    logger.info('Attempting in-cluster configuration');
    kc.loadFromCluster();
    return true;
  } catch (error) {
    logger.warn('In-cluster configuration failed');
  }

  // Method 4: Try default load (environment variables, etc.)
  try {
    logger.info('Attempting default kubeconfig load');
    kc.loadFromDefault();
    return true;
  } catch (error) {
    logger.warn('Default kubeconfig load failed');
  }

  return false;
}

async function testClusterConnection() {
  try {
    const response = await k8sApi.listNamespace();
    if (response.body.items.length >= 0) {
      logger.info(`✓ Cluster connection test successful. Found ${response.body.items.length} namespaces`);
      return true;
    }
  } catch (error) {
    throw new Error(`Cluster connection test failed: ${error.message}`);
  }
}

// Initialize on startup
initializeKubernetesClient().then(success => {
  if (!success) {
    logger.error('Could not connect to Kubernetes cluster. Some features may be unavailable.');
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Rate limiting (improved)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || 60000);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || 100);

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

// Cleanup old rate limit entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimit.entries()) {
    if (now > value.resetTime + RATE_LIMIT_WINDOW) {
      rateLimit.delete(key);
    }
  }
}, 3600000);

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cluster: {
      connected: clusterConnected,
      context: mockMode ? 'codespace-mock' : (clusterConnected && kc ? kc.getCurrentContext() : null),
      server: mockMode ? 'mock://codespace' : (clusterConnected && kc ? kc.getCurrentCluster()?.server : null),
      mockMode: mockMode
    }
  });
});

app.get('/api/health/cluster', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ 
      status: 'disconnected',
      error: 'Kubernetes cluster is not connected'
    });
  }

  try {
    const nodes = await k8sApi.listNode();
    const readyNodes = nodes.body.items.filter(n => 
      n.status.conditions.find(c => c.type === 'Ready' && c.status === 'True')
    ).length;

    res.json({
      status: clusterConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      cluster: {
        totalNodes: nodes.body.items.length,
        readyNodes: readyNodes,
        context: kc.getCurrentContext(),
        server: kc.getCurrentCluster()?.server
      }
    });
  } catch (error) {
    logger.error('Cluster health check failed', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/api/health/nodes', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const response = await k8sApi.listNode();
    const nodeHealth = response.body.items.map(node => ({
      name: node.metadata.name,
      ready: node.status.conditions.find(c => c.type === 'Ready')?.status === 'True',
      conditions: node.status.conditions.map(c => ({
        type: c.type,
        status: c.status,
        message: c.message
      }))
    }));

    res.json({ nodes: nodeHealth, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Node health check failed', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CLUSTER INFORMATION ENDPOINTS
// ============================================================================

app.get('/api/cluster/info', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    if (mockMode) {
      return res.json({
        connected: true,
        context: 'codespace-mock',
        apiServer: 'mock://codespace',
        nodes: mockClusterData.nodes.length,
        readyNodes: mockClusterData.nodes.length,
        pods: mockClusterData.pods.length,
        services: mockClusterData.services.length,
        deployments: mockClusterData.deployments.length,
        namespaces: 2,
        timestamp: new Date().toISOString(),
        mockMode: true
      });
    }

    const [nodes, pods, services, deployments, namespaces] = await Promise.allSettled([
      k8sApi.listNode(),
      k8sApi.listPodForAllNamespaces(),
      k8sApi.listServiceForAllNamespaces(),
      k8sAppsApi.listDeploymentForAllNamespaces(),
      k8sApi.listNamespace()
    ]);

    const clusterInfo = {
      connected: true,
      context: kc.getCurrentContext(),
      apiServer: kc.getCurrentCluster()?.server,
      nodes: nodes.status === 'fulfilled' ? nodes.value.body.items.length : 0,
      readyNodes: nodes.status === 'fulfilled' ? 
        nodes.value.body.items.filter(n => 
          n.status.conditions.find(c => c.type === 'Ready' && c.status === 'True')
        ).length : 0,
      pods: pods.status === 'fulfilled' ? pods.value.body.items.length : 0,
      services: services.status === 'fulfilled' ? services.value.body.items.length : 0,
      deployments: deployments.status === 'fulfilled' ? deployments.value.body.items.length : 0,
      namespaces: namespaces.status === 'fulfilled' ? namespaces.value.body.items.length : 0,
      timestamp: new Date().toISOString()
    };

    res.json(clusterInfo);
  } catch (error) {
    logger.error('Failed to get cluster info', error);
    res.status(500).json({ error: 'Failed to get cluster information' });
  }
});

app.get('/api/cluster/details', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const cluster = kc.getCurrentCluster();
    const user = kc.getCurrentUser();

    res.json({
      cluster: {
        name: cluster?.name,
        server: cluster?.server,
        caFile: cluster?.caFile ? 'configured' : 'not configured',
        insecureSkipTlsVerify: cluster?.insecureSkipTlsVerify
      },
      user: {
        name: user?.name,
        authProvider: user?.authProvider ? 'configured' : 'not configured'
      },
      context: kc.getCurrentContext()
    });
  } catch (error) {
    logger.error('Failed to get cluster details', error);
    res.status(500).json({ error: 'Failed to get cluster details' });
  }
});

// ============================================================================
// NODES ENDPOINTS
// ============================================================================

app.get('/api/nodes', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    if (mockMode) {
      return res.json(mockClusterData.nodes.map(n => ({
        name: n.name,
        status: n.status,
        ready: n.ready,
        roles: n.roles,
        cpu: n.cpu,
        memory: n.memory,
        os: n.os,
        kubeletVersion: n.version,
        creationTimestamp: new Date().toISOString(),
        age: '29d'
      })));
    }

    const response = await k8sApi.listNode();
    const nodes = response.body.items.map(node => ({
      name: node.metadata.name,
      status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
      ready: node.status.conditions.find(c => c.type === 'Ready')?.status === 'True',
      roles: node.metadata.labels?.['node-role.kubernetes.io/control-plane'] ? ['control-plane'] : 
             node.metadata.labels?.['node-role.kubernetes.io/worker'] ? ['worker'] : [],
      cpu: node.status.capacity?.cpu || 'Unknown',
      memory: node.status.capacity?.memory || 'Unknown',
      storage: node.status.capacity?.['storage'] || 'Unknown',
      os: node.status.nodeInfo?.osImage || 'Unknown',
      kubeletVersion: node.status.nodeInfo?.kubeletVersion || 'Unknown',
      creationTimestamp: node.metadata.creationTimestamp,
      age: calculateAge(node.metadata.creationTimestamp)
    }));

    res.json(nodes);
  } catch (error) {
    logger.error('Failed to get nodes', error);
    res.status(500).json({ error: 'Failed to get nodes' });
  }
});

app.get('/api/nodes/:name', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const response = await k8sApi.readNode(req.params.name);
    const node = response.body;

    res.json({
      name: node.metadata.name,
      status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
      labels: node.metadata.labels || {},
      conditions: node.status.conditions,
      capacity: node.status.capacity,
      allocatable: node.status.allocatable,
      nodeInfo: node.status.nodeInfo,
      creationTimestamp: node.metadata.creationTimestamp
    });
  } catch (error) {
    logger.error(`Failed to get node ${req.params.name}`, error);
    res.status(500).json({ error: `Failed to get node: ${error.message}` });
  }
});

// ============================================================================
// PODS ENDPOINTS
// ============================================================================

app.get('/api/pods', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const namespace = req.query.namespace || 'default';

    if (mockMode) {
      return res.json(mockClusterData.pods.filter(p => p.namespace === namespace || namespace === 'all').map(p => ({
        name: p.name,
        namespace: p.namespace,
        status: p.status,
        nodeName: p.nodeName,
        containers: [{name: 'app', image: 'nginx:latest', ports: []}],
        containerStatuses: [{restartCount: 0}],
        creationTimestamp: new Date().toISOString(),
        age: '2d',
        labels: {},
        restartCount: 0
      })));
    }

    const response = await k8sApi.listNamespacedPod(namespace);
    
    const pods = response.body.items.map(pod => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      status: pod.status.phase,
      nodeName: pod.spec.nodeName,
      containers: pod.spec.containers.map(c => ({
        name: c.name,
        image: c.image,
        ports: c.ports || [],
        resources: c.resources
      })),
      containerStatuses: pod.status.containerStatuses || [],
      creationTimestamp: pod.metadata.creationTimestamp,
      age: calculateAge(pod.metadata.creationTimestamp),
      labels: pod.metadata.labels || {},
      restartCount: pod.status.containerStatuses?.[0]?.restartCount || 0
    }));

    res.json(pods);
  } catch (error) {
    logger.error('Failed to get pods', error);
    res.status(500).json({ error: 'Failed to get pods' });
  }
});

app.get('/api/pods/:namespace/:name/logs', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const logs = await k8sApi.readNamespacedPodLog(
      req.params.name,
      req.params.namespace,
      req.query.container || undefined,
      true,
      null,
      null,
      false,
      5000  // tail last 5000 lines
    );

    res.set('Content-Type', 'text/plain');
    res.send(logs);
  } catch (error) {
    logger.error(`Failed to get pod logs`, error);
    res.status(500).json({ error: `Failed to get pod logs: ${error.message}` });
  }
});

// ============================================================================
// SERVICES ENDPOINTS
// ============================================================================

app.get('/api/services', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

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
      creationTimestamp: service.metadata.creationTimestamp,
      age: calculateAge(service.metadata.creationTimestamp),
      labels: service.metadata.labels || {}
    }));

    res.json(services);
  } catch (error) {
    logger.error('Failed to get services', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

// ============================================================================
// DEPLOYMENTS ENDPOINTS
// ============================================================================

app.get('/api/deployments', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

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
      updatedReplicas: deployment.status.updatedReplicas || 0,
      containers: deployment.spec.template.spec.containers.map(c => ({
        name: c.name,
        image: c.image
      })),
      creationTimestamp: deployment.metadata.creationTimestamp,
      age: calculateAge(deployment.metadata.creationTimestamp),
      labels: deployment.metadata.labels || {},
      conditions: deployment.status.conditions || []
    }));

    res.json(deployments);
  } catch (error) {
    logger.error('Failed to get deployments', error);
    res.status(500).json({ error: 'Failed to get deployments' });
  }
});

// ============================================================================
// NAMESPACES ENDPOINTS
// ============================================================================

app.get('/api/namespaces', async (req, res) => {
  if (!clusterConnected) {
    return res.status(503).json({ error: 'Cluster not connected' });
  }

  try {
    const clientId = req.ip || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const response = await k8sApi.listNamespace();
    const namespaces = response.body.items.map(ns => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      creationTimestamp: ns.metadata.creationTimestamp,
      age: calculateAge(ns.metadata.creationTimestamp),
      labels: ns.metadata.labels || {}
    }));

    res.json(namespaces);
  } catch (error) {
    logger.error('Failed to get namespaces', error);
    res.status(500).json({ error: 'Failed to get namespaces' });
  }
});

// ============================================================================
// WEBSOCKET FOR REAL-TIME UPDATES
// ============================================================================

io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  if (clusterConnected) {
    sendClusterUpdate(socket);
    
    const updateInterval = setInterval(() => {
      if (io.engine.clientsCount > 0) {
        sendClusterUpdate(socket);
      }
    }, process.env.WS_UPDATE_INTERVAL || 5000);
    
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
      clearInterval(updateInterval);
    });
  } else {
    socket.emit('error', { message: 'Cluster not connected' });
  }
  
  socket.on('subscribe-namespace', (namespace) => {
    socket.join(`namespace-${namespace}`);
    logger.info(`Client ${socket.id} subscribed to namespace ${namespace}`);
  });
  
  socket.on('unsubscribe-namespace', (namespace) => {
    socket.leave(`namespace-${namespace}`);
    logger.info(`Client ${socket.id} unsubscribed from namespace ${namespace}`);
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
      connected: true,
      nodes: nodes.status === 'fulfilled' ? nodes.value.body.items.map(node => ({
        name: node.metadata.name,
        status: node.status.conditions.find(c => c.type === 'Ready')?.status || 'Unknown',
        ready: node.status.conditions.find(c => c.type === 'Ready')?.status === 'True',
        cpu: node.status.capacity?.cpu || 'Unknown',
        memory: node.status.capacity?.memory || 'Unknown'
      })) : [],
      pods: pods.status === 'fulfilled' ? pods.value.body.items.length : 0,
      services: services.status === 'fulfilled' ? services.value.body.items.length : 0,
      deployments: deployments.status === 'fulfilled' ? deployments.value.body.items.length : 0,
      timestamp: new Date().toISOString()
    };

    socket.emit('cluster-update', clusterData);
  } catch (error) {
    logger.error('Error sending cluster update', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateAge(creationTimestamp) {
  const now = new Date();
  const created = new Date(creationTimestamp);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return 'now';
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((error, req, res, next) => {
  logger.error('Unhandled error', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`════════════════════════════════════════════════════════════`);
  logger.info(`Kubernetes Playground Backend`);
  logger.info(`════════════════════════════════════════════════════════════`);
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Cluster connected: ${clusterConnected}`);
  if (!mockMode && kc) {
    logger.info(`Context: ${kc.getCurrentContext()}`);
    logger.info(`API Server: ${kc.getCurrentCluster()?.server}`);
  } else {
    logger.info(`Mode: ${mockMode ? 'MOCK (simulated data)' : 'Real cluster'}`);
  }
  logger.info(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`════════════════════════════════════════════════════════════`);
});

module.exports = app;
