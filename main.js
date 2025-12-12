// Kubernetes Playground - Main JavaScript File
// Comprehensive interactive functionality for all pages

// Global state management
const AppState = {
    currentPage: '',
    clusterState: {
        nodes: 3,
        pods: 12,
        services: 4,
        deployments: 2,
        cpuUsage: 45,
        memoryUsage: 62,
        networkRate: 1.2
    },
    tutorialProgress: {
        beginner: 0,
        intermediate: 0,
        advanced: 0
    },
    currentTutorial: null,
    currentStep: 0
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadPageSpecificContent();
    
    // Initialize cluster integration if on playground page
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.includes('.html')) {
        const clusterIntegration = new K8sRealClusterIntegration();
        clusterIntegration.initialize().catch(err => {
            console.warn('Real cluster unavailable, using simulated mode');
        });
    }
});

// Application initialization
function initializeApp() {
    // Determine current page
    const path = window.location.pathname;
    if (path.includes('tutorials.html')) {
        AppState.currentPage = 'tutorials';
    } else if (path.includes('reference.html')) {
        AppState.currentPage = 'reference';
    } else {
        AppState.currentPage = 'playground';
    }
    
    // Load saved state from localStorage
    loadAppState();
    
    // Initialize animations
    initializeAnimations();
    
    console.log('Kubernetes Playground initialized');
}

// Event listeners setup
function setupEventListeners() {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // Page-specific event listeners
    switch (AppState.currentPage) {
        case 'playground':
            setupPlaygroundListeners();
            break;
        case 'tutorials':
            setupTutorialListeners();
            break;
        case 'reference':
            setupReferenceListeners();
            break;
    }
}

// Playground page event listeners
function setupPlaygroundListeners() {
    // Cluster simulation controls
    const startSimulation = document.getElementById('start-simulation');
    if (startSimulation) {
        startSimulation.addEventListener('click', startClusterSimulation);
    }
    
    // Node management
    const addNode = document.getElementById('add-node');
    const removeNode = document.getElementById('remove-node');
    
    if (addNode) {
        addNode.addEventListener('click', function() {
            updateClusterState('nodes', AppState.clusterState.nodes + 1);
        });
    }
    
    if (removeNode) {
        removeNode.addEventListener('click', function() {
            if (AppState.clusterState.nodes > 1) {
                updateClusterState('nodes', AppState.clusterState.nodes - 1);
            }
        });
    }
    
    // Resource sliders
    const cpuSlider = document.getElementById('cpu-slider');
    const memorySlider = document.getElementById('memory-slider');
    
    if (cpuSlider) {
        cpuSlider.addEventListener('input', function() {
            document.getElementById('cpu-value').textContent = this.value + ' cores';
            updateResourceUsage();
        });
    }
    
    if (memorySlider) {
        memorySlider.addEventListener('input', function() {
            document.getElementById('memory-value').textContent = this.value + ' GB';
            updateResourceUsage();
        });
    }
    
    // Quick action buttons
    const deployNginx = document.getElementById('deploy-nginx');
    const deployRedis = document.getElementById('deploy-redis');
    const createService = document.getElementById('create-service');
    
    if (deployNginx) {
        deployNginx.addEventListener('click', function() {
            deployApplication('nginx', 'nginx:latest');
        });
    }
    
    if (deployRedis) {
        deployRedis.addEventListener('click', function() {
            deployApplication('redis', 'redis:alpine');
        });
    }
    
    if (createService) {
        createService.addEventListener('click', function() {
            createKubernetesService();
        });
    }
    
    // Pod builder modal
    const openPodBuilder = document.getElementById('open-pod-builder');
    const podBuilderModal = document.getElementById('pod-builder-modal');
    const closePodBuilder = document.getElementById('close-pod-builder');
    const cancelPodBuilder = document.getElementById('cancel-pod-builder');
    const deployPod = document.getElementById('deploy-pod');
    
    if (openPodBuilder && podBuilderModal) {
        openPodBuilder.addEventListener('click', function() {
            podBuilderModal.classList.remove('hidden');
            initializePodBuilder();
        });
    }
    
    if (closePodBuilder) {
        closePodBuilder.addEventListener('click', closePodBuilderModal);
    }
    
    if (cancelPodBuilder) {
        cancelPodBuilder.addEventListener('click', closePodBuilderModal);
    }
    
    if (deployPod) {
        deployPod.addEventListener('click', deployCustomPod);
    }
    
    // Canvas controls
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    
    if (zoomIn) {
        zoomIn.addEventListener('click', function() {
            zoomCanvas(1.2);
        });
    }
    
    if (zoomOut) {
        zoomOut.addEventListener('click', function() {
            zoomCanvas(0.8);
        });
    }
}

// Tutorial page event listeners
function setupTutorialListeners() {
    // Tutorial cards
    const tutorialCards = document.querySelectorAll('.tutorial-card');
    tutorialCards.forEach(card => {
        card.addEventListener('click', function() {
            const level = this.dataset.level;
            startTutorial(level);
        });
    });
    
    // Tutorial modal controls
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorial = document.getElementById('close-tutorial');
    const prevStep = document.getElementById('prev-step');
    const nextStep = document.getElementById('next-step');
    
    if (closeTutorial) {
        closeTutorial.addEventListener('click', closeTutorialModal);
    }
    
    if (prevStep) {
        prevStep.addEventListener('click', previousTutorialStep);
    }
    
    if (nextStep) {
        nextStep.addEventListener('click', nextTutorialStep);
    }
    
    // Start learning button
    const startLearning = document.getElementById('start-learning');
    if (startLearning) {
        startLearning.addEventListener('click', function() {
            startTutorial('beginner');
        });
    }
    
    // Browse tutorials button
    const browseTutorials = document.getElementById('browse-tutorials');
    if (browseTutorials) {
        browseTutorials.addEventListener('click', function() {
            document.querySelector('.tutorial-card').scrollIntoView({ behavior: 'smooth' });
        });
    }
}

// Reference page event listeners
function setupReferenceListeners() {
    // Category tabs
    const categoryTabs = document.querySelectorAll('.category-tab');
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.dataset.category;
            switchCategory(category);
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchReference(this.value);
        });
    }
}

// Cluster simulation functions
function startClusterSimulation() {
    const canvas = document.getElementById('cluster-visualization');
    const placeholder = document.getElementById('canvas-placeholder');
    
    if (canvas && placeholder) {
        placeholder.style.display = 'none';
        initializeClusterVisualization(canvas);
        
        // Update button text
        const button = document.getElementById('start-simulation');
        if (button) {
            button.textContent = 'Simulation Running...';
            button.disabled = true;
        }
    }
}

function initializeClusterVisualization(container) {
    // Create a simple animated cluster visualization
    const visualization = document.createElement('div');
    visualization.className = 'cluster-viz w-full h-full flex items-center justify-center';
    
    // Generate nodes
    for (let i = 0; i < AppState.clusterState.nodes; i++) {
        const node = document.createElement('div');
        node.className = 'cluster-node w-16 h-16 bg-blue-500 rounded-lg m-2 flex items-center justify-center text-white font-bold cursor-pointer';
        node.textContent = `Node ${i + 1}`;
        node.addEventListener('click', function() {
            showNodeDetails(i + 1);
        });
        
        // Add floating animation
        node.style.animation = `float ${3 + Math.random() * 2}s ease-in-out infinite`;
        node.style.animationDelay = `${Math.random() * 2}s`;
        
        visualization.appendChild(node);
    }
    
    container.appendChild(visualization);
    
    // Start real-time updates
    startRealTimeUpdates();
}

function showNodeDetails(nodeNumber) {
    const nodeDetails = document.getElementById('node-details');
    const nodeInfo = document.getElementById('node-info');
    
    if (nodeDetails && nodeInfo) {
        nodeInfo.innerHTML = `
            <strong>Node ${nodeNumber}</strong><br>
            Status: Ready<br>
            CPU: ${Math.floor(Math.random() * 80) + 20}%<br>
            Memory: ${Math.floor(Math.random() * 60) + 40}%<br>
            Pods: ${Math.floor(Math.random() * 5) + 1}<br>
            Age: ${Math.floor(Math.random() * 30) + 1} days
        `;
        nodeDetails.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            nodeDetails.classList.add('hidden');
        }, 5000);
    }
}

function updateClusterState(key, value) {
    AppState.clusterState[key] = value;
    updateUI();
    saveAppState();
}

function updateResourceUsage() {
    // Simulate resource usage based on cluster state
    const cpuUsage = Math.min(95, AppState.clusterState.cpuUsage + Math.random() * 10 - 5);
    const memoryUsage = Math.min(95, AppState.clusterState.memoryUsage + Math.random() * 8 - 4);
    const networkRate = Math.max(0.1, AppState.clusterState.networkRate + Math.random() * 0.5 - 0.25);
    
    updateClusterState('cpuUsage', Math.round(cpuUsage));
    updateClusterState('memoryUsage', Math.round(memoryUsage));
    updateClusterState('networkRate', Math.round(networkRate * 10) / 10);
}

function updateUI() {
    // Update status counters
    const elements = {
        'node-count': AppState.clusterState.nodes,
        'pod-count': AppState.clusterState.pods,
        'service-count': AppState.clusterState.services,
        'deployment-count': AppState.clusterState.deployments
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
    
    // Update resource meters
    const cpuPercentage = document.getElementById('cpu-percentage');
    const memoryPercentage = document.getElementById('memory-percentage');
    const networkRate = document.getElementById('network-rate');
    const cpuBar = document.getElementById('cpu-bar');
    const memoryBar = document.getElementById('memory-bar');
    const networkBar = document.getElementById('network-bar');
    
    if (cpuPercentage) cpuPercentage.textContent = AppState.clusterState.cpuUsage + '%';
    if (memoryPercentage) memoryPercentage.textContent = AppState.clusterState.memoryUsage + '%';
    if (networkRate) networkRate.textContent = AppState.clusterState.networkRate + ' MB/s';
    if (cpuBar) cpuBar.style.width = AppState.clusterState.cpuUsage + '%';
    if (memoryBar) memoryBar.style.width = AppState.clusterState.memoryUsage + '%';
    if (networkBar) networkBar.style.width = (AppState.clusterState.networkRate * 20) + '%'; // Scale for display
}

function startRealTimeUpdates() {
    // Update every 3 seconds
    setInterval(() => {
        updateResourceUsage();
        updateTerminalOutput();
    }, 3000);
}

function updateTerminalOutput() {
    const terminal = document.getElementById('terminal-output');
    if (!terminal) return;
    
    const commands = [
        'kubectl get pods',
        'kubectl get services',
        'kubectl top nodes',
        'kubectl cluster-info',
        'kubectl get deployments'
    ];
    
    const command = commands[Math.floor(Math.random() * commands.length)];
    const output = generateMockTerminalOutput(command);
    
    // Add new command to terminal
    const newLine = document.createElement('div');
    newLine.className = 'mt-2';
    newLine.innerHTML = `<div class="text-blue-300">$ ${command}</div>${output}`;
    
    terminal.appendChild(newLine);
    
    // Keep only last 10 lines
    const lines = terminal.children;
    if (lines.length > 10) {
        terminal.removeChild(lines[0]);
    }
    
    // Scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
}

function generateMockTerminalOutput(command) {
    const outputs = {
        'kubectl get pods': `
            <div class="text-blue-300">NAME                     READY   STATUS    RESTARTS   AGE</div>
            <div>nginx-7b8c5f6f8c-2m5v9   1/1     Running   0          ${Math.floor(Math.random() * 30) + 1}m</div>
            <div>redis-6f9c5f6f8c-7k2p4   1/1     Running   0          ${Math.floor(Math.random() * 30) + 1}m</div>
        `,
        'kubectl get services': `
            <div class="text-blue-300">NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)</div>
            <div>kubernetes   ClusterIP   10.96.0.1       &lt;none&gt;        443/TCP</div>
            <div>nginx        ClusterIP   10.96.0.2       &lt;none&gt;        80/TCP</div>
        `,
        'kubectl top nodes': `
            <div class="text-blue-300">NAME       CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%</div>
            <div>worker-1   250m         12%    1024Mi          25%</div>
            <div>worker-2   300m         15%    1536Mi          38%</div>
        `,
        'kubectl cluster-info': `
            <div class="text-blue-300">Kubernetes control plane is running at https://localhost:6443</div>
            <div>CoreDNS is running at https://localhost:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy</div>
        `,
        'kubectl get deployments': `
            <div class="text-blue-300">NAME    READY   UP-TO-DATE   AVAILABLE   AGE</div>
            <div>nginx   3/3     3            3           ${Math.floor(Math.random() * 60) + 1}m</div>
        `
    };
    
    return outputs[command] || '<div class="text-blue-300">Command executed successfully</div>';
}

// Application deployment functions
function deployApplication(name, image) {
    updateClusterState('pods', AppState.clusterState.pods + 1);
    
    // Show deployment notification
    showNotification(`Deploying ${name} with image ${image}`, 'success');
    
    // Add to terminal
    updateTerminalOutput();
    
    // Animate the deployment
    animateDeployment(name);
}

function createKubernetesService() {
    updateClusterState('services', AppState.clusterState.services + 1);
    showNotification('Service created successfully', 'success');
    animateServiceCreation();
}

function animateDeployment(name) {
    // Create temporary visual element for deployment animation
    const animation = document.createElement('div');
    animation.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-lg z-50';
    animation.textContent = `${name} deployed successfully!`;
    document.body.appendChild(animation);
    
    // Animate in
    anime({
        targets: animation,
        scale: [0, 1],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutBack',
        complete: function() {
            setTimeout(() => {
                anime({
                    targets: animation,
                    scale: 0,
                    opacity: 0,
                    duration: 300,
                    complete: function() {
                        document.body.removeChild(animation);
                    }
                });
            }, 2000);
        }
    });
}

function animateServiceCreation() {
    // Similar animation for service creation
    const animation = document.createElement('div');
    animation.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-6 py-3 rounded-lg z-50';
    animation.textContent = 'Service created and exposed!';
    document.body.appendChild(animation);
    
    anime({
        targets: animation,
        scale: [0, 1],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutBack',
        complete: function() {
            setTimeout(() => {
                anime({
                    targets: animation,
                    scale: 0,
                    opacity: 0,
                    duration: 300,
                    complete: function() {
                        document.body.removeChild(animation);
                    }
                });
            }, 2000);
        }
    });
}

// Pod builder functions
function initializePodBuilder() {
    const imageOptions = document.querySelectorAll('.image-option');
    const customImageInput = document.getElementById('custom-image');
    const addEnvVar = document.getElementById('add-env-var');
    
    imageOptions.forEach(option => {
        option.addEventListener('click', function() {
            const image = this.dataset.image;
            selectImageOption(image, customImageInput);
        });
    });
    
    if (addEnvVar) {
        addEnvVar.addEventListener('click', addEnvironmentVariable);
    }
    
    updateYAMLPreview();
}

function selectImageOption(image, customInput) {
    // Remove active state from all options
    document.querySelectorAll('.image-option').forEach(opt => {
        opt.classList.remove('border-blue-500', 'bg-blue-50');
        opt.classList.add('border-gray-200');
    });
    
    // Add active state to selected option
    event.target.classList.remove('border-gray-200');
    event.target.classList.add('border-blue-500', 'bg-blue-50');
    
    // Show/hide custom image input
    if (customInput) {
        if (image === 'custom') {
            customInput.classList.remove('hidden');
        } else {
            customInput.classList.add('hidden');
        }
    }
    
    updateYAMLPreview();
}

function addEnvironmentVariable() {
    const container = document.getElementById('env-vars');
    const newVar = document.createElement('div');
    newVar.className = 'flex gap-2';
    newVar.innerHTML = `
        <input type="text" placeholder="KEY" class="flex-1 p-2 border border-gray-300 rounded-lg">
        <input type="text" placeholder="VALUE" class="flex-1 p-2 border border-gray-300 rounded-lg">
        <button class="remove-env px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">×</button>
    `;
    
    container.appendChild(newVar);
    
    // Add remove functionality
    const removeBtn = newVar.querySelector('.remove-env');
    removeBtn.addEventListener('click', function() {
        container.removeChild(newVar);
        updateYAMLPreview();
    });
    
    updateYAMLPreview();
}

function updateYAMLPreview() {
    const yamlPreview = document.getElementById('yaml-preview');
    if (!yamlPreview) return;
    
    const selectedImage = document.querySelector('.image-option.border-blue-500');
    const customImage = document.getElementById('custom-image');
    const cpuRequest = document.getElementById('cpu-request')?.value || '100m';
    const memoryRequest = document.getElementById('memory-request')?.value || '128Mi';
    const cpuLimit = document.getElementById('cpu-limit')?.value || '500m';
    const memoryLimit = document.getElementById('memory-limit')?.value || '512Mi';
    
    let image = 'nginx:latest';
    if (selectedImage?.dataset.image === 'custom' && customImage) {
        image = customImage.value || 'nginx:latest';
    } else if (selectedImage) {
        const imageMap = {
            'nginx': 'nginx:latest',
            'redis': 'redis:alpine',
            'mysql': 'mysql:8.0'
        };
        image = imageMap[selectedImage.dataset.image] || 'nginx:latest';
    }
    
    const yaml = generatePodYAML({
        image,
        cpuRequest,
        memoryRequest,
        cpuLimit,
        memoryLimit
    });
    
    yamlPreview.textContent = yaml;
}

function generatePodYAML(config) {
    return `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  labels:
    app: my-app
spec:
  containers:
  - name: my-container
    image: ${config.image}
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "${config.memoryRequest}"
        cpu: "${config.cpuRequest}"
      limits:
        memory: "${config.memoryLimit}"
        cpu: "${config.cpuLimit}"`;
}

function deployCustomPod() {
    const modal = document.getElementById('pod-builder-modal');
    const yamlPreview = document.getElementById('yaml-preview');
    
    if (yamlPreview) {
        showNotification('Pod configuration deployed!', 'success');
        updateClusterState('pods', AppState.clusterState.pods + 1);
        closePodBuilderModal();
        
        // Add deployment to terminal
        updateTerminalOutput();
    }
}

function closePodBuilderModal() {
    const modal = document.getElementById('pod-builder-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Tutorial functions
function startTutorial(level) {
    AppState.currentTutorial = level;
    AppState.currentStep = 0;
    
    const modal = document.getElementById('tutorial-modal');
    const title = document.getElementById('tutorial-title');
    
    if (modal && title) {
        title.textContent = getTutorialTitle(level);
        modal.classList.remove('hidden');
        loadTutorialStep(level, 0);
    }
}

function getTutorialTitle(level) {
    const titles = {
        'beginner': 'Kubernetes Fundamentals',
        'intermediate': 'Advanced Configuration',
        'advanced': 'Production Operations'
    };
    return titles[level] || 'Kubernetes Tutorial';
}

function loadTutorialStep(level, step) {
    const content = document.getElementById('tutorial-content');
    const progress = document.getElementById('tutorial-progress');
    const stepIndicator = document.getElementById('tutorial-step');
    const prevBtn = document.getElementById('prev-step');
    const nextBtn = document.getElementById('next-step');
    
    const tutorialData = getTutorialData(level);
    const currentStepData = tutorialData.steps[step];
    
    if (!currentStepData) return;
    
    // Update content
    content.innerHTML = generateTutorialStepHTML(currentStepData);
    
    // Update progress
    const progressPercent = ((step + 1) / tutorialData.steps.length) * 100;
    if (progress) progress.style.width = progressPercent + '%';
    if (stepIndicator) stepIndicator.textContent = `Step ${step + 1} of ${tutorialData.steps.length}`;
    
    // Update buttons
    if (prevBtn) prevBtn.disabled = step === 0;
    if (nextBtn) {
        nextBtn.textContent = step === tutorialData.steps.length - 1 ? 'Complete' : 'Next Step';
        nextBtn.disabled = false;
    }
    
    // Animate step transition
    anime({
        targets: content,
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        easing: 'easeOutQuart'
    });
}

function getTutorialData(level) {
    const tutorials = {
        'beginner': {
            steps: [
                {
                    title: 'What is Kubernetes?',
                    content: 'Kubernetes is a container orchestration platform that automates the deployment, scaling, and management of containerized applications.',
                    code: 'kubectl version',
                    interactive: true
                },
                {
                    title: 'Understanding Pods',
                    content: 'Pods are the smallest deployable units in Kubernetes. A pod can contain one or more containers that share storage and network.',
                    code: 'kubectl get pods',
                    interactive: true
                },
                {
                    title: 'Creating Your First Pod',
                    content: 'Let\'s create a simple pod running an nginx container. This will demonstrate the basic pod creation process.',
                    code: 'kubectl run nginx --image=nginx:latest',
                    interactive: true
                },
                {
                    title: 'Exploring Services',
                    content: 'Services provide stable network endpoints for accessing your pods. They enable service discovery and load balancing.',
                    code: 'kubectl expose pod nginx --port=80',
                    interactive: true
                }
            ]
        },
        'intermediate': {
            steps: [
                {
                    title: 'ConfigMaps and Secrets',
                    content: 'Learn how to manage configuration data and sensitive information separately from your application code.',
                    code: 'kubectl create configmap app-config --from-literal=database=postgres',
                    interactive: true
                },
                {
                    title: 'Deployment Strategies',
                    content: 'Understand rolling updates and how to deploy new versions of your application without downtime.',
                    code: 'kubectl create deployment web --image=nginx:1.20',
                    interactive: true
                },
                {
                    title: 'Health Checks',
                    content: 'Implement liveness and readiness probes to ensure your applications are healthy and ready to serve traffic.',
                    code: '# See YAML template for health check configuration',
                    interactive: false
                },
                {
                    title: 'Resource Management',
                    content: 'Set resource requests and limits to ensure proper scheduling and resource allocation.',
                    code: '# Resource limits are configured in the YAML template',
                    interactive: false
                }
            ]
        },
        'advanced': {
            steps: [
                {
                    title: 'Monitoring and Observability',
                    content: 'Set up monitoring, logging, and tracing for production Kubernetes clusters.',
                    code: 'kubectl apply -f monitoring/prometheus.yaml',
                    interactive: true
                },
                {
                    title: 'Auto Scaling',
                    content: 'Configure horizontal pod autoscaling based on CPU and memory metrics.',
                    code: 'kubectl autoscale deployment web --cpu-percent=50 --min=1 --max=10',
                    interactive: true
                },
                {
                    title: 'Security Best Practices',
                    content: 'Implement RBAC, network policies, and pod security policies for secure deployments.',
                    code: '# Security configurations are in YAML templates',
                    interactive: false
                },
                {
                    title: 'Advanced Networking',
                    content: 'Configure ingress controllers, service meshes, and advanced networking patterns.',
                    code: 'kubectl apply -f ingress/nginx-ingress.yaml',
                    interactive: true
                }
            ]
        }
    };
    
    return tutorials[level] || tutorials['beginner'];
}

function generateTutorialStepHTML(stepData) {
    return `
        <div class="lesson-step active">
            <h4 class="font-display text-xl font-semibold text-gray-900 mb-4">${stepData.title}</h4>
            <p class="text-gray-700 mb-6">${stepData.content}</p>
            ${stepData.code ? `
                <div class="code-container relative">
                    <div class="code-block">
                        <pre>${stepData.code}</pre>
                    </div>
                    <button class="copy-button" onclick="copyToClipboard('${stepData.code.replace(/'/g, "\\'")}')">Copy</button>
                </div>
            ` : ''}
            ${stepData.interactive ? `
                <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                    <p class="text-sm text-blue-800">
                        <strong>Interactive Exercise:</strong> Try this command in the playground or follow along with the simulation.
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

function nextTutorialStep() {
    const tutorialData = getTutorialData(AppState.currentTutorial);
    
    if (AppState.currentStep < tutorialData.steps.length - 1) {
        AppState.currentStep++;
        loadTutorialStep(AppState.currentTutorial, AppState.currentStep);
    } else {
        // Tutorial completed
        completeTutorial();
    }
}

function previousTutorialStep() {
    if (AppState.currentStep > 0) {
        AppState.currentStep--;
        loadTutorialStep(AppState.currentTutorial, AppState.currentStep);
    }
}

function completeTutorial() {
    // Update progress
    AppState.tutorialProgress[AppState.currentTutorial] = 100;
    saveAppState();
    
    // Show completion message
    showNotification(`Congratulations! You've completed the ${getTutorialTitle(AppState.currentTutorial)} tutorial!`, 'success');
    
    // Close modal
    closeTutorialModal();
}

function closeTutorialModal() {
    const modal = document.getElementById('tutorial-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    AppState.currentTutorial = null;
    AppState.currentStep = 0;
}

// Reference page functions
function switchCategory(category) {
    // Update tab states
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Show/hide content sections
    document.querySelectorAll('.category-content').forEach(section => {
        section.classList.add('hidden');
    });
    
    const targetSection = document.getElementById(`${category}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
}

function searchReference(query) {
    if (!query) return;
    
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;
    
    // Simple search implementation - in a real app, this would search through a database
    const results = performSearch(query);
    
    if (results.length > 0) {
        searchResults.innerHTML = results.map(result => `
            <div class="search-result p-4 border-b border-gray-200 hover:bg-gray-50">
                <h4 class="font-medium">${result.title}</h4>
                <p class="text-sm text-gray-600">${result.description}</p>
            </div>
        `).join('');
        searchResults.classList.remove('hidden');
    } else {
        searchResults.classList.add('hidden');
    }
}

function performSearch(query) {
    // Mock search results - in a real app, this would query a search index
    const mockResults = [
        { title: 'kubectl get pods', description: 'List all pods in the current namespace' },
        { title: 'Pod Configuration', description: 'Learn how to configure pod resources and limits' },
        { title: 'Service Types', description: 'Understanding ClusterIP, NodePort, and LoadBalancer services' },
        { title: 'Deployment Strategies', description: 'Rolling updates and deployment patterns' }
    ];
    
    return mockResults.filter(result => 
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.description.toLowerCase().includes(query.toLowerCase())
    );
}

// Utility functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy to clipboard', 'error');
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    anime({
        targets: notification,
        translateX: [300, 0],
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutQuart'
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        anime({
            targets: notification,
            translateX: 300,
            opacity: 0,
            duration: 300,
            complete: function() {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }
        });
    }, 3000);
}

function initializeAnimations() {
    // Initialize scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    document.querySelectorAll('.glass-card, .tutorial-card, .command-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

function loadPageSpecificContent() {
    switch (AppState.currentPage) {
        case 'playground':
            initializePlaygroundContent();
            break;
        case 'tutorials':
            initializeTutorialContent();
            break;
        case 'reference':
            initializeReferenceContent();
            break;
    }
}

function initializePlaygroundContent() {
    updateUI();
    
    // Initialize resource chart if ECharts is available
    if (typeof echarts !== 'undefined') {
        initializeResourceChart();
    }
}

function initializeTutorialContent() {
    // Update progress indicators
    updateProgressIndicators();
}

function initializeReferenceContent() {
    // Initialize search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.focus();
    }
}

function initializeResourceChart() {
    const chartContainer = document.getElementById('resource-chart');
    if (!chartContainer) return;
    
    const chart = echarts.init(chartContainer);
    
    const option = {
        title: {
            text: 'Resource Usage',
            textStyle: { fontSize: 14, color: '#4a5568' }
        },
        tooltip: { trigger: 'axis' },
        legend: { data: ['CPU', 'Memory', 'Network'] },
        xAxis: {
            type: 'category',
            data: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:25']
        },
        yAxis: { type: 'value' },
        series: [
            {
                name: 'CPU',
                type: 'line',
                data: [40, 45, 50, 48, 52, 45],
                itemStyle: { color: '#2d7d8e' }
            },
            {
                name: 'Memory',
                type: 'line',
                data: [58, 62, 65, 60, 64, 62],
                itemStyle: { color: '#c05621' }
            },
            {
                name: 'Network',
                type: 'line',
                data: [1.0, 1.2, 1.5, 1.3, 1.4, 1.2],
                itemStyle: { color: '#38b2ac' }
            }
        ]
    };
    
    chart.setOption(option);
    
    // Update chart periodically
    setInterval(() => {
        const newData = generateNewChartData();
        chart.setOption({
            series: [
                { data: newData.cpu },
                { data: newData.memory },
                { data: newData.network }
            ]
        });
    }, 5000);
}

function generateNewChartData() {
    const cpu = [];
    const memory = [];
    const network = [];
    
    for (let i = 0; i < 6; i++) {
        cpu.push(Math.floor(Math.random() * 30) + 30);
        memory.push(Math.floor(Math.random() * 20) + 50);
        network.push(Math.round((Math.random() * 1 + 0.5) * 10) / 10);
    }
    
    return { cpu, memory, network };
}

function updateProgressIndicators() {
    // Update progress rings and indicators based on tutorial progress
    Object.entries(AppState.tutorialProgress).forEach(([level, progress]) => {
        const progressRing = document.querySelector(`[data-level="${level}"] .progress-ring-circle`);
        if (progressRing) {
            const circumference = 2 * Math.PI * 30; // radius = 30
            const offset = circumference - (progress / 100) * circumference;
            progressRing.style.strokeDashoffset = offset;
        }
    });
}

// Canvas functions
function zoomCanvas(factor) {
    const canvas = document.getElementById('cluster-visualization');
    if (!canvas) return;
    
    const currentScale = canvas.style.transform.match(/scale\(([^)]+)\)/);
    const scale = currentScale ? parseFloat(currentScale[1]) : 1;
    const newScale = Math.max(0.5, Math.min(3, scale * factor));
    
    canvas.style.transform = `scale(${newScale})`;
}

// State persistence
function saveAppState() {
    try {
        localStorage.setItem('k8sPlaygroundState', JSON.stringify(AppState));
    } catch (error) {
        console.warn('Failed to save app state:', error);
    }
}

function loadAppState() {
    try {
        const saved = localStorage.getItem('k8sPlaygroundState');
        if (saved) {
            const state = JSON.parse(saved);
            Object.assign(AppState, state);
        }
    } catch (error) {
        console.warn('Failed to load app state:', error);
    }
}

// YAML templates for reference page
const podTemplate = `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  labels:
    app: my-app
spec:
  containers:
  - name: my-container
    image: nginx:latest
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"`;

const deploymentTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-container
        image: nginx:latest
        ports:
        - containerPort: 80
        env:
        - name: ENVIRONMENT
          value: "production"`;

const serviceTemplate = `apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP`;

const configMapTemplate = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  database_url: "postgresql://localhost:5432/mydb"
  debug_mode: "true"
  config.yaml: |
    server:
      port: 8080
      host: 0.0.0.0
    database:
      max_connections: 100`;

const resourceLimits = `resources:
  requests:
    memory: "64Mi"
    cpu: "250m"
  limits:
    memory: "128Mi"
    cpu: "500m"`;

const healthChecks = `livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5`;

const labels = `labels:
  app.kubernetes.io/name: my-app
  app.kubernetes.io/component: backend
  app.kubernetes.io/version: "1.0"
  environment: production`;

const securityContext = `securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL`;

// Export for global access
window.K8sPlayground = {
    AppState,
    copyToClipboard,
    showNotification,
    startClusterSimulation,
    deployApplication,
    createKubernetesService,
    startTutorial,
    switchCategory
};