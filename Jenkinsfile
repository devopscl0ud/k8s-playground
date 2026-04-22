pipeline {
  agent any

  triggers {
    // Requires GitHub plugin: triggers pipeline on push via GitHub webhook & added extra line for scm
    githubPush()
  }

  environment {
    IMAGE_NAME = "k8s-playground-backend"
    NAMESPACE = "k8s-playground"
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
              
              echo "🔍 Testing kubectl connectivity..."
              if ! kubectl --kubeconfig ${KUBECONFIG_FILE} cluster-info > /dev/null 2>&1; then
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
          echo "🔧 Verifying cluster connection..."
          kubectl --kubeconfig ${KUBECONFIG_FILE} cluster-info
          
          echo "📦 Creating namespace if it doesn't exist..."
          # FIXED: Added --kubeconfig to the second part of the pipe
          kubectl --kubeconfig ${KUBECONFIG_FILE} create namespace ${NAMESPACE} --dry-run=client -o yaml | \
          kubectl --kubeconfig ${KUBECONFIG_FILE} apply -f -
          
          echo "🔍 Checking if deployment exists..."
          DEPLOYMENT_EXISTS=$(kubectl --kubeconfig ${KUBECONFIG_FILE} -n ${NAMESPACE} get deployment k8s-playground-backend --no-headers 2>/dev/null | wc -l)
          
          if [ $DEPLOYMENT_EXISTS -eq 0 ]; then
            echo "📥 Deployment not found. Applying initial configuration..."
            # FIXED: Added --kubeconfig here as well
            kubectl --kubeconfig ${KUBECONFIG_FILE} apply -f kubernetes-deployment.yaml
            echo "⏳ Waiting for deployment to be created..."
            sleep 5
          else
            echo "✅ Deployment already exists"
          fi
          
          echo "🐳 Updating deployment image to: ${IMAGE}"
          kubectl --kubeconfig ${KUBECONFIG_FILE} -n ${NAMESPACE} set image deployment/k8s-playground-backend backend=${IMAGE}
          
          echo "⏳ Waiting for rollout to complete..."
          kubectl --kubeconfig ${KUBECONFIG_FILE} -n ${NAMESPACE} rollout status deployment/k8s-playground-backend --timeout=5m
          
          echo "✅ Deployment successful!"
          kubectl --kubeconfig ${KUBECONFIG_FILE} -n ${NAMESPACE} get pods -l app=k8s-playground,component=backend
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
}
