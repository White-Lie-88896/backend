# Cloud CI deploy

This workflow builds the custom Remnawave backend image in GitHub Actions, pushes it to GHCR, then asks `DC1` to pull and switch to that image.

The production server does not build images.

## What changes compared with local CI

- Build machine: GitHub hosted runner.
- Image transfer: GHCR pull instead of `docker save`, `scp`, and `docker load`.
- Production work: `docker pull`, backup, optional Prisma migrations, compose image switch, health check.
- Source requirement: all backend and frontend changes must be committed and pushed before running the workflow.

## Required GitHub secrets

Set these in the backend repository under `Settings -> Secrets and variables -> Actions`.

- `DC1_HOST`: public IP or DNS name for the production server.
- `DC1_USER`: restricted SSH deploy user. The configured value is `remnawave-deploy`.
- `DC1_PORT`: SSH port. If omitted, the workflow uses `22`.
- `DC1_SSH_KEY`: private SSH key for `remnawave-deploy`. The key is forced to the `/usr/local/sbin/remnawave-deploy-dispatch` command on DC1.
- `FRONTEND_DEPLOY_KEY`: read-only deploy key for `White-Lie-88896/frontend`.

The workflow pushes with the built-in `GITHUB_TOKEN`, and DC1 pulls using the same temporary workflow token during the deploy job. Long-lived `GHCR_TOKEN`, `GHCR_USERNAME`, and `FRONTEND_REPO_TOKEN` secrets are not required.

## First safe run

Open GitHub Actions and run `Cloud Build and Deploy to DC1`.

Keep `plan_only` set to `true`. The workflow checks out backend/frontend, prepares the image tag, writes a summary, then stops before Docker build, push, SSH, or production changes.

## Build-only run

Run the same workflow with:

- `plan_only`: `false`
- `deploy_to_prod`: `false`
- `image_tag`: optional, for example `2.7.4-cloud-v1`
- `frontend_repository`: `White-Lie-88896/frontend`
- `frontend_ref`: `custom`

This builds the image in GitHub Actions, smoke tests it, and pushes it to GHCR without SSH or production changes.

## Real deploy run

Run the same workflow with:

- `plan_only`: `false`
- `deploy_to_prod`: `true`
- `image_tag`: optional, for example `2.7.4-cloud-v1`
- `frontend_repository`: `White-Lie-88896/frontend`
- `frontend_ref`: `custom`
- `run_migrations`: `true` when backend migrations are part of the build

The deployed image will look like:

```text
ghcr.io/white-lie-88896/backend:<tag>
```

## Rollback

Every deploy creates a backup under `/opt/remnawave-backups/<timestamp>-<image>`.

The deploy log prints a rollback command like:

```bash
cp -a '/opt/remnawave-backups/<backup>/docker-compose.before-ci.yml' '/opt/remnawave/docker-compose.yml' && cd '/opt/remnawave' && docker compose -f '/opt/remnawave/docker-compose.yml' up -d 'remnawave'
```

Database migrations are not automatically rolled back. If a release contains destructive migrations, take a database backup before running the deploy.
