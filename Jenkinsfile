pipeline {
  agent any

  triggers {
    githubPush()
  }

  environment {
    IMAGE_NAME = "k8s-playground-backend"
    NAMESPACE = "k8s-playground"
    KUBE_CONFIG = ""  // Not needed with token auth
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        // Optional: Install Node.js if not pre-installed on agent
        sh '''
          if ! command -v node >/dev/null 2>&1; then
            echo "Installing Node.js..."
            # For Ubuntu/Debian agents:
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
          fi
          npm ci
          npm test || true
        '''
      }
    }

    stage('Validate Deployment Prerequisites') {
      steps {
        // Using the service account token credentials
        withCredentials([string(credentialsId: 'jenkins-k8s-token', variable: 'K8S_TOKEN')]) {
          sh '''
            # Set up kubectl to use the token
            export KUBECONFIG="${WORKSPACE}/kubeconfig"
            
            # Create a minimal kubeconfig using the token
            mkdir -p "$(dirname "${KUBECONFIG}")"
            cat > "${KUBECONFIG}" <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://<your-api-server>:6443  # REPLACE WITH YOUR API SERVER
    insecure-skip-tls-verify: true  # Set to false if you have valid certs
  name: cluster
contexts:
- context:
    cluster: cluster
    user: jenkins
  name: jenkins-context
current-context: jenkins-context
users:
- name: jenkins
  user:
    token: ${K8S_TOKEN}
EOF
            
            echo "✓ kubeconfig created with service account token"
            kubectl cluster-info
            kubectl auth can-i create deployments  # Should return "yes"
          '''
        }
      }
    }

    stage('Build & Push Image') {
      steps {
        script {
          def shortSha = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
          env.IMAGE = "${params.REGISTRY}/${env.IMAGE_NAME}:${env.BUILD_NUMBER}-${shortSha}"

          sh "docker build -t ${env.IMAGE} ."
          
          withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
            sh '''
              echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
              docker push "$IMAGE"
            '''
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        withCredentials([string(credentialsId: 'jenkins-k8s-token', variable: 'K8S_TOKEN')]) {
          sh '''
            export KUBECONFIG="${WORKSPACE}/kubeconfig"
            
            echo "Creating namespace if needed..."
            kubectl get namespace ${NAMESPACE} || kubectl create namespace ${NAMESPACE}
            
            echo "Checking if deployment exists..."
            if ! kubectl -n ${NAMESPACE} get deployment k8s-playground-backend >/dev/null 2>&1; then
              echo "Creating initial deployment..."
              kubectl -n ${NAMESPACE} apply -f kubernetes-deployment.yaml
            fi
            
            echo "Updating deployment image to: ${IMAGE}"
            kubectl -n ${NAMESPACE} set image deployment/k8s-playground-backend backend=${IMAGE}
            
            echo "Waiting for rollout to complete..."
            kubectl -n ${NAMESPACE} rollout status deployment/k8s-playground-backend --timeout=3m
            
            echo "✅ Deployment successful!"
            echo "Pod status:"
            kubectl -n ${NAMESPACE} get pods -l app=k8s-playground,component=backend
          '''
        }
      }
    }
  }

  parameters {
    string(name: 'REGISTRY', defaultValue: 'docker.io/venky2222', description: 'Container registry (e.g. docker.io/username or registry.example.com/repo)')
  }

  post {
    success {
      echo """
      ✅ PIPELINE SUCCEEDED
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Image: ${env.IMAGE}
      Namespace: ${env.NAMESPACE}
      Deployment: k8s-playground-backend
      Build: ${env.BUILD_NUMBER}
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      """
    }
    failure {
      echo """
      ❌ PIPELINE FAILED
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      Build ID: ${env.BUILD_NUMBER}
      Image: ${env.IMAGE}
      Namespace: ${env.NAMESPACE}
      
      📋 Troubleshooting steps:
      1. Verify jenkins-k8s-token credentials are set in Jenkins
      2. Check kubectl can connect to cluster with the token
      3. Ensure docker-hub-creds have valid Docker Hub token
      4. Review pod logs: kubectl -n ${env.NAMESPACE} logs -l app=k8s-playground
      5. Check deployment status: kubectl -n ${env.NAMESPACE} describe deployment k8s-playground-backend
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      """
    }
  }
}
