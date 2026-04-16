# Jenkins CI/CD setup for k8s-playground

This document explains the Jenkins credential names, how to populate them, and quick test/deploy commands.

Credentials used by the pipeline (Jenkins):

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

---
Last updated: 2026-04-16
