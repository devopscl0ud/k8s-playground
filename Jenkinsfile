pipeline {
    agent any
    
    environment {
        IMAGE_NAME = "k8s-playground-backend"
        NAMESPACE = "k8s-playground"
        KUBE_SERVER = "https://10.128.0.8:6443"
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install & Test') {
            steps {
                // Install Node.js using nvm (no sudo needed)
                sh '''
                    if ! command -v node >/dev/null 2>&1; then
                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        nvm install 20
                        nvm use 20
                    fi
                    npm ci
                    npm test || true
                '''
            }
        }
        
        stage('Validate Deployment Prerequisites') {
            steps {
                withCredentials([string(credentialsId: 'jenkins-k8s-sa-token', variable: 'K8S_TOKEN')]) {
                    sh '''
                        export KUBECONFIG="${WORKSPACE}/kubeconfig"
                        mkdir -p "$(dirname "${KUBECONFIG}")"
                        cat > "${KUBECONFIG}" <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: ${KUBE_SERVER}
    insecure-skip-tls-verify: true
  name: k8s
contexts:
- context:
    cluster: k8s
    user: sa
  name: sa-context
current-context: sa-context
users:
- name: sa
  user:
    token: ${K8S_TOKEN}
EOF
                        
                        echo "✓ Testing kubectl connectivity..."
                        kubectl cluster-info
                        kubectl auth can-i create deployments
                        kubectl auth can-i get pods
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
                withCredentials([string(credentialsId: 'jenkins-k8s-sa-token', variable: 'K8S_TOKEN')]) {
                    sh '''
                        export KUBECONFIG="${WORKSPACE}/kubeconfig"
                        
                        echo "🚀 Starting deployment..."
                        
                        kubectl get namespace ${NAMESPACE} || kubectl create namespace ${NAMESPACE}
                        
                        if ! kubectl -n ${NAMESPACE} get deployment k8s-playground-backend >/dev/null 2>&1; then
                            kubectl -n ${NAMESPACE} apply -f kubernetes-deployment.yaml
                        fi
                        
                        kubectl -n ${NAMESPACE} set image deployment/k8s-playground-backend backend=${IMAGE}
                        kubectl -n ${NAMESPACE} rollout status deployment/k8s-playground-backend --timeout=3m
                        
                        echo "✅ Deployment successful!"
                        kubectl -n ${NAMESPACE} get pods -l app=k8s-playground,component=backend
                    '''
                }
            }
        }
    }
    
    parameters {
        string(name: 'REGISTRY', defaultValue: 'docker.io/venky2222', description: 'Container registry')
    }
    
    post {
        success {
            echo '''
            ✅ PIPELINE SUCCEEDED
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            Image: ${env.IMAGE}
            Namespace: ${env.NAMESPACE}
            Deployment: k8s-playground-backend
            Build: ${env.BUILD_NUMBER}
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            '''
        }
        failure {
            echo '''
            ❌ PIPELINE FAILED
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            Build ID: ${env.BUILD_NUMBER}
            Image: ${env.IMAGE}
            Namespace: ${env.NAMESPACE}
            
            📋 Troubleshooting:
            1. Verify jenkins-k8s-sa-token credentials exist in Jenkins
            2. Check token value matches what you retrieved from kubectl
            3. Ensure docker-hub-creds credentials exist
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            '''
        }
    }
}
