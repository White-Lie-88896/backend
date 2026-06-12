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
- `DC1_USER`: SSH user, usually `root` or a Docker-capable deploy user. If omitted, the workflow uses `root`.
- `DC1_PORT`: SSH port. If omitted, the workflow uses `22`.
- `DC1_SSH_KEY`: private SSH key that can log in to `DC1`.
- `GHCR_TOKEN`: GitHub PAT with `read:packages` so `DC1` can pull private GHCR images. Not required if the GHCR package is public or DC1 is already logged in.
- `GHCR_USERNAME`: GitHub username for the GHCR pull login. If omitted, the workflow uses the GitHub actor.
- `FRONTEND_REPO_TOKEN`: PAT with read access to `White-Lie-88896/frontend` if the frontend repo is private and the default workflow token cannot read it.

The workflow pushes with the built-in `GITHUB_TOKEN`, so the backend repository needs workflow permission `packages: write`, which is already declared in the workflow file.

## First safe run

Open GitHub Actions and run `Cloud Build and Deploy to DC1`.

Keep `plan_only` set to `true`. The workflow checks out backend/frontend, prepares the image tag, writes a summary, then stops before Docker build, push, SSH, or production changes.

## Real deploy run

Run the same workflow with:

- `plan_only`: `false`
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
