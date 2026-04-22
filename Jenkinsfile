pipeline {
  agent any

  triggers {
    // Requires GitHub plugin: triggers pipeline on push via GitHub webhook & added extra line for scm
    githubPush()
  }

  environment {
    IMAGE_NAME = "k8s-playground-backend"
    NAMESPACE = "k8s-playground"
    KUBECONFIG_PATH = "/tmp/kubeconfig"
    PROXY_PORT = "8001"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        sh '''
          set -e
          # Install Node.js via nvm if not available (avoids sudo)
          if ! command -v node >/dev/null 2>&1; then
            echo "Node.js not found - installing via nvm..."
            # Install nvm
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
            # Load nvm into current shell
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
            [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"
            # Install Node.js 20 LTS
            nvm install 20
            nvm use 20
          fi
          echo "Node version: $(node -v)"
          echo "NPM version: $(npm -v)"
          npm ci
          npm test || true
        '''
      }
    }

    stage('Validate Deployment Prerequisites') {
      steps {
        script {
          echo "🔍 Validating deployment prerequisites..."
          withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG_FILE')]) {
            sh '''
              set -e
              echo "✓ kubeconfig-credentials are available"
              
              # Copy kubeconfig to a known location
              cp "${KUBECONFIG_FILE}" ${KUBECONFIG_PATH}
              export KUBECONFIG=${KUBECONFIG_PATH}
              
              echo "🔍 Testing kubectl connectivity..."
              if ! kubectl cluster-info > /dev/null 2>&1; then
                echo "❌ ERROR: Cannot connect to Kubernetes cluster with provided kubeconfig"
                exit 1
              fi
              echo "✓ Successfully connected to Kubernetes cluster"
              
              echo "🔍 Verifying registry credentials configuration..."
              if [ -z "${REGISTRY}" ]; then
                echo "❌ ERROR: REGISTRY parameter is not set"
                exit 1
              fi
              echo "✓ Registry configured: ${REGISTRY}"
            '''
          }
        }
      }
    }

    stage('Build & Push Image') {
      steps {
        script {
          // Use env.IMAGE so it's available in the sh blocks
          def shortSha = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortSha}"
          env.IMAGE = "${params.REGISTRY}/${env.IMAGE_NAME}:${env.IMAGE_TAG}"

          sh "docker build -t ${env.IMAGE} ."
          
          withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
            sh '''
              # Log into the base domain only
              echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin docker.io
              
              # Push using the full image name
              docker push "$IMAGE"
            '''
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        script {
          withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG_FILE')]) {
            sh '''
              set -e
              echo "🔧 Setting up authenticated kubectl proxy..."
              
              # Copy kubeconfig to a known location
              cp "${KUBECONFIG_FILE}" ${KUBECONFIG_PATH}
              export KUBECONFIG=${KUBECONFIG_PATH}
              
              # Start kubectl proxy in background to handle authentication
              echo "Starting kubectl proxy on port ${PROXY_PORT}..."
              kubectl proxy --port=${PROXY_PORT} --address=0.0.0.0 --disable-filter=true &
              PROXY_PID=$!
              
              # Give proxy time to start
              sleep 3
              
              # Verify proxy is running
              if ! curl -s http://localhost:${PROXY_PORT}/api/ > /dev/null; then
                echo "❌ ERROR: Failed to start kubectl proxy"
                kill $PROXY_PID 2>/dev/null || true
                exit 1
              fi
              echo "✓ kubectl proxy is running"
              
              echo "📦 Creating namespace if it doesn't exist..."
              # Use localhost proxy for all kubectl commands
              curl -s -X POST -H "Content-Type: application/yaml" \
                --data-binary "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${NAMESPACE}" \
                http://localhost:${PROXY_PORT}/api/v1/namespaces || true
              
              echo "🔍 Checking if deployment exists..."
              DEPLOYMENT_EXISTS=$(curl -s http://localhost:${PROXY_PORT}/apis/apps/v1/namespaces/${NAMESPACE}/deployments/k8s-playground-backend 2>/dev/null | grep -c '"name":"k8s-playground-backend"' || echo 0)
              
              if [ $DEPLOYMENT_EXISTS -eq 0 ]; then
                echo "📥 Deployment not found. Applying initial configuration from kubernetes-deployment.yaml..."
                curl -s -X PUT -H "Content-Type: application/yaml" \
                  --data-binary @kubernetes-deployment.yaml \
                  http://localhost:${PROXY_PORT}/apis/apps/v1/namespaces/${NAMESPACE}/deployments/k8s-playground-backend
                echo "⏳ Waiting for deployment to be created..."
                sleep 5
              else
                echo "✅ Deployment already exists"
              fi
              
              echo "🐳 Updating deployment image to: ${IMAGE}"
              # Patch the deployment image
              PATCH_DATA="{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"backend\",\"image\":\"${IMAGE}\"}]}}}}"
              curl -s -X PATCH -H "Content-Type: application/strategic-merge-patch+json" \
                --data-binary "$PATCH_DATA" \
                http://localhost:${PROXY_PORT}/apis/apps/v1/namespaces/${NAMESPACE}/deployments/k8s-playground-backend
              
              echo "⏳ Waiting for rollout to complete (timeout: 5m)..."
              # Wait for rollout by checking deployment status
              for i in {1..30}; do
                ROLLOUT_STATUS=$(curl -s http://localhost:${PROXY_PORT}/apis/apps/v1/namespaces/${NAMESPACE}/deployments/k8s-playground-backend | grep -c '"availableReplicas":1' || echo 0)
                if [ $ROLLOUT_STATUS -eq 1 ]; then
                  echo "✅ Deployment rolled out successfully"
                  break
                fi
                echo "Waiting for rollout... ($i/30)"
                sleep 10
              done
              
              if [ $ROLLOUT_STATUS -ne 1 ]; then
                echo "❌ ERROR: Deployment rollout timed out"
                kill $PROXY_PID 2>/dev/null || true
                exit 1
              fi
              
              echo "✅ Deployment successful!"
              echo "Pod status:"
              curl -s http://localhost:${PROXY_PORT}/api/v1/namespaces/${NAMESPACE}/pods?labelSelector=app%3Dk8s-playground%2Ccomponent%3Dbackend
              
              # Cleanup proxy
              echo "Stopping kubectl proxy..."
              kill $PROXY_PID 2>/dev/null || true
            '''
          }
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
      1. Verify kubeconfig-credentials are set in Jenkins
      2. Check kubectl can connect to cluster with the kubeconfig
      3. Ensure docker-hub-creds have valid Docker Hub token
      4. Review pod logs: kubectl -n ${env.NAMESPACE} logs -l app=k8s-playground
      5. Check deployment status: kubectl -n ${env.NAMESPACE} describe deployment k8s-playground-backend
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      """
    }
  }
}
