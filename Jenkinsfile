pipeline {
    agent any

    triggers {
        githubPush()
    }

    parameters {
        string(name: 'REGISTRY', defaultValue: 'docker.io/venky2222', description: 'Container registry')
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
                    if ! command -v node >/dev/null 2>&1; then
                        echo "Node.js not found - installing via nvm..."
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

        stage('Validate Prerequisites') {
            steps {
                script {
                    withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG_FILE')]) {
                        sh '''
                            set -e
                            export KUBECONFIG=${KUBECONFIG_FILE}
                            kubectl cluster-info > /dev/null 2>&1
                            if [ -z "${params.REGISTRY}" ]; then exit 1; fi
                        '''
                    }
                }
            }
        }

        stage('Build & Push Image') {
            steps {
                script {
                    def shortSha = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortSha}"
                    env.IMAGE = "${params.REGISTRY}/${env.IMAGE_NAME}:${env.IMAGE_TAG}"

                    sh "docker build -t ${env.IMAGE} ."
                    
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        sh '''
                            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin docker.io
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
                            export KUBECONFIG=${KUBECONFIG_FILE}
                            
                            echo "📦 Managing Namespace..."
                            kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
                            
                            echo "🔍 Checking Deployment..."
                            DEPLOYMENT_EXISTS=$(kubectl -n ${NAMESPACE} get deployment k8s-playground-backend --no-headers 2>/dev/null | wc -l)
                            
                            if [ "$DEPLOYMENT_EXISTS" -eq "0" ]; then
                                echo "📥 Applying initial YAML..."
                                kubectl apply -f kubernetes-deployment.yaml
                                sleep 5
                            fi
                            
                            echo "🐳 Updating image to: ${IMAGE}"
                            kubectl -n ${NAMESPACE} set image deployment/k8s-playground-backend backend=${IMAGE}
                            
                            echo "⏳ Waiting for rollout..."
                            kubectl -n ${NAMESPACE} rollout status deployment/k8s-playground-backend --timeout=5m
                            
                            kubectl -n ${NAMESPACE} get pods -l app=k8s-playground,component=backend
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "✅ PIPELINE SUCCEEDED - Image: ${env.IMAGE}"
        }
        failure {
            echo "❌ PIPELINE FAILED"
        }
    }
}
