// Frontend Integration for Real Kubernetes Cluster
// This file extends the main.js functionality to connect with the backend API

class K8sRealClusterIntegration {
  constructor(backendUrl = 'http://localhost:3001') {
    this.backendUrl = backendUrl;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  // Initialize the real cluster integration
  async initialize() {
    try {
      await this.checkBackendHealth();
      await this.connectWebSocket();
      await this.loadRealClusterData();
      this.isConnected = true;
      console.log('Connected to real Kubernetes cluster');
      return true;
    } catch (error) {
      console.error('Failed to connect to real cluster:', error);
      this.handleConnectionError(error);
      return false;
    }
  }

  // Check if backend is healthy
  async checkBackendHealth() {
    try {
      const response = await fetch(`${this.backendUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
      const data = await response.json();
      console.log('Backend health:', data);
      return true;
    } catch (error) {
      console.error('Backend health check failed:', error);
      throw error;
    }
  }

  // Connect to WebSocket for real-time updates
  connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.backendUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('cluster-update', (data) => {
          this.updateClusterVisualization(data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.handleDisconnection(reason);
        });

        this.socket.on('reconnect_attempt', (attempt) => {
          console.log('WebSocket reconnection attempt:', attempt);
          this.reconnectAttempts = attempt;
        });

        this.socket.on('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });

        // Set connection timeout
        setTimeout(() => {
          if (!this.socket.connected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  // Load real cluster data from backend
  async loadRealClusterData() {
    try {
      const [clusterInfo, nodes, pods, services, deployments] = await Promise.all([
        this.fetchClusterInfo(),
        this.fetchNodes(),
        this.fetchPods(),
        this.fetchServices(),
        this.fetchDeployments()
      ]);

      // Update the playground state with real data
      this.updatePlaygroundState({
        clusterInfo,
        nodes,
        pods,
        services,
        deployments
      });

      // Update UI
      this.updateRealClusterUI();

    } catch (error) {
      console.error('Failed to load cluster data:', error);
      throw error;
    }
  }

  // Fetch cluster information
  async fetchClusterInfo() {
    try {
      const response = await fetch(`${this.backendUrl}/api/cluster/info`);
      if (!response.ok) throw new Error(`Failed to fetch cluster info: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching cluster info:', error);
      throw error;
    }
  }

  // Fetch nodes
  async fetchNodes() {
    try {
      const response = await fetch(`${this.backendUrl}/api/nodes`);
      if (!response.ok) throw new Error(`Failed to fetch nodes: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching nodes:', error);
      throw error;
    }
  }

  // Fetch pods
  async fetchPods(namespace = 'default') {
    try {
      const response = await fetch(`${this.backendUrl}/api/pods?namespace=${namespace}`);
      if (!response.ok) throw new Error(`Failed to fetch pods: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching pods:', error);
      throw error;
    }
  }

  // Fetch services
  async fetchServices(namespace = 'default') {
    try {
      const response = await fetch(`${this.backendUrl}/api/services?namespace=${namespace}`);
      if (!response.ok) throw new Error(`Failed to fetch services: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching services:', error);
      throw error;
    }
  }

  // Fetch deployments
  async fetchDeployments(namespace = 'default') {
    try {
      const response = await fetch(`${this.backendUrl}/api/deployments?namespace=${namespace}`);
      if (!response.ok) throw new Error(`Failed to fetch deployments: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching deployments:', error);
      throw error;
    }
  }

  // Fetch namespaces
  async fetchNamespaces() {
    try {
      const response = await fetch(`${this.backendUrl}/api/namespaces`);
      if (!response.ok) throw new Error(`Failed to fetch namespaces: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      throw error;
    }
  }

  // Update playground state with real cluster data
  updatePlaygroundState(data) {
    if (typeof AppState !== 'undefined') {
      AppState.realClusterData = {
        clusterInfo: data.clusterInfo,
        nodes: data.nodes,
        pods: data.pods,
        services: data.services,
        deployments: data.deployments,
        lastUpdated: new Date().toISOString()
      };

      // Update cluster state with real data
      if (data.clusterInfo) {
        AppState.clusterState.nodes = data.clusterInfo.nodes || 0;
        AppState.clusterState.pods = data.clusterInfo.pods || 0;
        AppState.clusterState.services = data.clusterInfo.services || 0;
        AppState.clusterState.deployments = data.clusterInfo.deployments || 0;
      }
    }
  }

  // Update cluster visualization with real data
  updateClusterVisualization(data) {
    // This function will be called when WebSocket updates are received
    console.log('Updating cluster visualization with real data:', data);

    // Update the main playground UI if the updateUI function exists
    if (typeof updateUI === 'function') {
      updateUI();
    }

    // Update the cluster visualization canvas
    this.updateClusterCanvas(data);
  }

  // Update the cluster visualization canvas
  updateClusterCanvas(data) {
    const canvas = document.getElementById('cluster-visualization');
    if (!canvas) return;

    // Clear existing visualization
    canvas.innerHTML = '';

    // Create real nodes visualization
    if (data.nodes && data.nodes.length > 0) {
      const nodesContainer = document.createElement('div');
      nodesContainer.className = 'real-nodes-container flex flex-wrap justify-center items-center gap-4 p-4';

      data.nodes.forEach((node, index) => {
        const nodeElement = this.createRealNodeElement(node, index);
        nodesContainer.appendChild(nodeElement);
      });

      canvas.appendChild(nodesContainer);
    }

    // Add real-time indicators
    this.addRealTimeIndicators(canvas);
  }

  // Create a real node element
  createRealNodeElement(node, index) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'real-node bg-blue-500 text-white rounded-lg p-4 m-2 cursor-pointer transition-all duration-300 hover:bg-blue-600 hover:scale-105';
    nodeDiv.style.animation = `float ${3 + Math.random() * 2}s ease-in-out infinite`;
    nodeDiv.style.animationDelay = `${Math.random() * 2}s`;

    const statusColor = node.status === 'True' ? 'bg-green-500' : 'bg-red-500';
    
    nodeDiv.innerHTML = `
      <div class="text-center">
        <div class="font-bold text-lg">${node.name}</div>
        <div class="text-sm opacity-90">${node.os || 'Unknown OS'}</div>
        <div class="flex items-center justify-center mt-2">
          <div class="w-3 h-3 ${statusColor} rounded-full mr-2"></div>
          <span class="text-xs">${node.status === 'True' ? 'Ready' : 'Not Ready'}</span>
        </div>
        <div class="text-xs mt-2">
          CPU: ${node.cpu || 'Unknown'} | Memory: ${node.memory || 'Unknown'}
        </div>
        <div class="text-xs mt-1">
          K8s: ${node.kubeletVersion || 'Unknown'}
        </div>
      </div>
    `;

    // Add click handler for node details
    nodeDiv.addEventListener('click', () => {
      this.showRealNodeDetails(node);
    });

    return nodeDiv;
  }

  // Show real node details
  showRealNodeDetails(node) {
    const nodeDetails = document.getElementById('node-details');
    const nodeInfo = document.getElementById('node-info');

    if (nodeDetails && nodeInfo) {
      nodeInfo.innerHTML = `
        <strong>${node.name}</strong><br>
        Status: ${node.status === 'True' ? 'Ready' : 'Not Ready'}<br>
        OS: ${node.os || 'Unknown'}<br>
        CPU: ${node.cpu || 'Unknown'}<br>
        Memory: ${node.memory || 'Unknown'}<br>
        Kubelet Version: ${node.kubeletVersion || 'Unknown'}<br>
        Created: ${new Date(node.creationTimestamp).toLocaleString()}
      `;
      nodeDetails.classList.remove('hidden');

      // Auto-hide after 8 seconds
      setTimeout(() => {
        nodeDetails.classList.add('hidden');
      }, 8000);
    }
  }

  // Add real-time indicators
  addRealTimeIndicators(canvas) {
    const indicator = document.createElement('div');
    indicator.className = 'real-time-indicator absolute top-4 right-4 flex items-center bg-green-500 text-white px-3 py-1 rounded-full text-xs';
    indicator.innerHTML = `
      <div class="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
      Live Cluster Data
    `;
    canvas.appendChild(indicator);
  }

  // Update UI for real cluster
  updateRealClusterUI() {
    // Update status indicators
    const statusIndicator = document.getElementById('cluster-status');
    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <div class="flex items-center text-green-600">
          <div class="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          Connected to Real Cluster
        </div>
      `;
    }

    // Update terminal with real cluster info
    this.updateTerminalWithRealData();
  }

  // Update terminal with real cluster data
  updateTerminalWithRealData() {
    const terminal = document.getElementById('terminal-output');
    if (!terminal || !AppState.realClusterData) return;

    const realData = AppState.realClusterData;
    
    terminal.innerHTML = `
      <div class="text-green-400">=== Connected to Real Kubernetes Cluster ===</div>
      <div class="mt-2 text-blue-300">$ kubectl cluster-info</div>
      <div>Connected to cluster with ${realData.clusterInfo?.nodes || 0} nodes</div>
      <div class="mt-2 text-blue-300">$ kubectl get nodes</div>
      <div>NAME           STATUS   ROLES    AGE   VERSION</div>
      ${realData.nodes?.slice(0, 3).map(node => 
        `<div>${node.name.padEnd(12)} Ready    &lt;none&gt;   ${Math.floor(Math.random() * 30) + 1}m   ${node.kubeletVersion || 'v1.28.0'}</div>`
      ).join('') || '<div>No nodes available</div>'}
      <div class="mt-2 text-blue-300">$ kubectl get pods --all-namespaces</div>
      <div>NAMESPACE     NAME                     READY   STATUS    RESTARTS   AGE</div>
      ${realData.pods?.slice(0, 3).map(pod => 
        `<div>${(pod.namespace || 'default').padEnd(10)} ${(pod.name || 'unknown').padEnd(20)} 1/1     Running   0          ${Math.floor(Math.random() * 30) + 1}m</div>`
      ).join('') || '<div>No pods available</div>'}
    `;
  }

  // Handle connection errors
  handleConnectionError(error) {
    console.error('Connection error:', error);
    
    // Show error in UI
    const statusIndicator = document.getElementById('cluster-status');
    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <div class="flex items-center text-red-600">
          <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
          Disconnected - Using Demo Mode
        </div>
      `;
    }

    // Fallback to demo mode
    this.enableDemoMode();
  }

  // Handle disconnection
  handleDisconnection(reason) {
    console.log('Disconnected from cluster:', reason);
    
    if (reason === 'io server disconnect') {
      // Server disconnected us, try to reconnect
      this.attemptReconnection();
    } else {
      // Other disconnection reason, fallback to demo mode
      this.enableDemoMode();
    }
  }

  // Attempt to reconnect
  attemptReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log(`Attempting reconnection ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
        this.initialize().then(connected => {
          if (connected) {
            console.log('Reconnected successfully');
          } else {
            this.reconnectAttempts++;
            this.attemptReconnection();
          }
        });
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    } else {
      console.log('Max reconnection attempts reached, falling back to demo mode');
      this.enableDemoMode();
    }
  }

  // Enable demo mode when real cluster is not available
  enableDemoMode() {
    console.log('Enabling demo mode');
    
    // Show demo mode indicator
    const statusIndicator = document.getElementById('cluster-status');
    if (statusIndicator) {
      statusIndicator.innerHTML = `
        <div class="flex items-center text-yellow-600">
          <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
          Demo Mode - Simulated Data
        </div>
      `;
    }

    // Start demo simulation
    if (typeof startClusterSimulation === 'function') {
      startClusterSimulation();
    }
  }

  // Subscribe to namespace updates
  subscribeToNamespace(namespace) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe-namespace', namespace);
    }
  }

  // Unsubscribe from namespace updates
  unsubscribeFromNamespace(namespace) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe-namespace', namespace);
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketConnected: this.socket && this.socket.connected,
      reconnectAttempts: this.reconnectAttempts,
      backendUrl: this.backendUrl
    };
  }
}

// Initialize real cluster integration when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the playground page
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    // Initialize real cluster integration
    const realCluster = new K8sRealClusterIntegration();
    
    // Try to connect to real cluster, fallback to demo mode if fails
    realCluster.initialize().then(connected => {
      if (connected) {
        console.log('Successfully connected to real Kubernetes cluster');
      } else {
        console.log('Using demo mode - no real cluster connection');
      }
    });
    
    // Make it globally available
    window.k8sRealCluster = realCluster;
    
    // Add connection status to UI
    addConnectionStatusToUI();
  }
});

// Add connection status indicator to UI
function addConnectionStatusToUI() {
  const nav = document.querySelector('nav');
  if (nav) {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'cluster-status';
    statusDiv.className = 'ml-4 flex items-center';
    statusDiv.innerHTML = `
      <div class="flex items-center text-gray-500">
        <div class="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
        Connecting to cluster...
      </div>
    `;
    nav.appendChild(statusDiv);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = K8sRealClusterIntegration;
}