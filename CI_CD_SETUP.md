# Jenkins CI/CD setup for k8s-playground

This document explains the Jenkins credential names, how to populate them, and quick test/deploy commands.

## 🚀 Quick Start

**New to this setup?** Follow these steps:

1. **Initialize your Kubernetes cluster** (one-time setup):
   ```bash
   ./scripts/01-init-cluster.sh your_docker_username your_docker_pat_token
   ```

2. **Add credentials to Jenkins** (see sections below)

3. **Create Jenkins Pipeline job** pointing to this repo's Jenkinsfile

4. **Having issues?** Run the troubleshooting script:
   ```bash
   ./scripts/02-troubleshoot-cicd.sh
   ```

📖 **Full troubleshooting guide:** [CICD_TROUBLESHOOTING.md](CICD_TROUBLESHOOTING.md)

---

## Credentials used by the pipeline (Jenkins):

- **docker-hub-creds** (Credentials type: "Username with password")
  - Username: `venky2222`
  - Password: your Docker Hub PAT (do NOT commit this in the repo)

- **kubeconfig-credentials** (Credentials type: "Secret file")
  - Upload your kubeconfig file here. The pipeline uses it with `--kubeconfig`.

Pipeline defaults and behavior

- The pipeline file is [Jenkinsfile](Jenkinsfile). It expects a parameter `REGISTRY` with a value like `docker.io/venky2222`.
- The pipeline builds an immutable image tag of the form `<BUILD_NUMBER>-<GIT_SHA>` and pushes to `${REGISTRY}/k8s-playground-backend:${IMAGE_TAG}`.
- Deployment is performed by running `kubectl --kubeconfig <file> -n k8s-playground set image deployment/k8s-playground-backend backend=<image>`.

Add image pull secret to the cluster

If you push images to Docker Hub (private) or any private registry, create a registry secret in the `k8s-playground` namespace and reference it as `registry-credentials`.

Run this locally (recommended to test before Jenkins job):

1. Build and push image (you already used this example):

```bash
docker build -t docker.io/venky2222/k8s-playground-backend:demo-1 .
docker push docker.io/venky2222/k8s-playground-backend:demo-1
```

2. Create Kubernetes `docker-registry` secret (one-off):

```bash
kubectl create secret docker-registry registry-credentials \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=venky2222 \
  --docker-password=YOUR_DOCKER_PAT \
  -n k8s-playground --dry-run=client -o yaml | kubectl apply -f -
```

3. Deploy the pushed image (same as Jenkins will do):

```bash
kubectl -n k8s-playground set image deployment/k8s-playground-backend backend=docker.io/venky2222/k8s-playground-backend:demo-1
kubectl -n k8s-playground rollout status deployment/k8s-playground-backend --timeout=3m
```

Add kubeconfig to Jenkins

- In Jenkins credentials, add a new **Secret file** credential and upload your kubeconfig. Use the ID `kubeconfig-credentials` (or update the `Jenkinsfile` if you used a different ID).
- Ensure the kubeconfig has a user/context with access to the `k8s-playground` namespace.

Security notes

- Never commit the kubeconfig or any secrets into git. The repository currently contains template placeholders named `REPLACE_WITH_BASE64_DOCKERCONFIGJSON` and `REPLACE_DB_URL` — replace these only via secure CI or `kubectl create secret` as shown above.
- The `registry-credentials` and `k8s-playground-secrets` manifests in [kubernetes-deployment.yaml](kubernetes-deployment.yaml) are templates only.

If you want, I can:

- Add a short Jenkins job template (declarative pipeline job) to import into Jenkins.
- Replace the manifest with a kustomize overlay to inject the image tags instead of using `kubectl set image`.

GitHub webhook (push) trigger

1. Install required Jenkins plugins (if not present):
  - GitHub plugin
  - Git plugin
  - Credentials Binding plugin

2. Create a Jenkins Pipeline job:
  - New Item -> Pipeline -> give it a name
  - In the Pipeline section, choose "Pipeline script from SCM"
  - SCM: Git, Repository URL: `https://github.com/devopscl0ud/k8s-playground.git`
  - Credentials: (use existing Git credentials if required)
  - Branch: `*/dev` (or `*/main` for production)
  - Script Path: `Jenkinsfile`
  - Build Triggers: check "GitHub hook trigger for GITScm polling"

3. Configure GitHub webhook (repo settings -> Webhooks):
  - Payload URL: `https://<JENKINS_BASE_URL>/github-webhook/`
  - Content type: `application/json`
  - Secret: optional (if you set a shared secret, configure the GitHub plugin accordingly)
  - Which events: "Just the push event"

4. Jenkins webhook notes:
  - If Jenkins is behind a firewall or NAT, expose it (ngrok, public IP, reverse proxy) or use GitHub App integration.
  - Ensure `Jenkins URL` (Manage Jenkins -> Configure System) is set to the externally reachable URL so GitHub can callback it.

5. Test the webhook:
  - In GitHub -> Webhooks -> select the webhook -> "Recent Deliveries" -> Redeliver the last payload or add a test by pushing a tiny commit.
  - You can also test using curl from any machine that can reach Jenkins:

```bash
curl -X POST -H "Content-Type: application/json" --data '{"ref":"refs/heads/dev"}' https://<JENKINS_BASE_URL>/github-webhook/
```

What Jenkins will do on push

- Checkout the pushed commit, run the pipeline in `Jenkinsfile`, build & push the image to `docker.io/venky2222`, and deploy the new image to the `k8s-playground` namespace using the uploaded kubeconfig credential.

If you'd like, I can also commit a `jenkins/job-template.xml` export for you to import into Jenkins as a preconfigured job. Otherwise, follow the steps above to create the job in the Jenkins UI.

---
Last updated: 2026-04-16
