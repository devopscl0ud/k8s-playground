pipeline {
  agent any

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
        sh 'npm ci'
        sh 'npm test || true'
      }
    }

    stage('Build & Push Image') {
      steps {
        script {
          def shortSha = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortSha}"
          env.IMAGE = "${params.REGISTRY}/${env.IMAGE_NAME}:${env.IMAGE_TAG}"

          withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
            sh "docker build -t ${env.IMAGE} ."
            sh "echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin ${params.REGISTRY}"
            sh "docker push ${env.IMAGE}"
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        script {
          withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG_FILE')]) {
            sh "kubectl --kubeconfig ${KUBECONFIG_FILE} -n ${env.NAMESPACE} set image deployment/k8s-playground-backend backend=${env.IMAGE}"
            sh "kubectl --kubeconfig ${KUBECONFIG_FILE} -n ${env.NAMESPACE} rollout status deployment/k8s-playground-backend --timeout=3m"
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
      echo "Deployed ${env.IMAGE} to ${env.NAMESPACE}"
    }
    failure {
      echo 'Build or deployment failed.'
    }
  }
}
