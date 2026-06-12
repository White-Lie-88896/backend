# Local CI deploy

This project uses a self-hosted GitHub Actions runner on the local Windows build machine. The runner builds the frontend and backend Docker image locally, uploads the final image archive to `DC1`, then the production server only loads and switches the image.

Nothing is built on the production server.

## One-time setup

1. In GitHub, open the backend repository.
2. Go to `Settings -> Actions -> Runners -> New self-hosted runner`.
3. Choose `Windows` and follow the commands shown by GitHub on the local Windows build machine.
4. Install the runner as a service so it can receive manual workflow runs after reboot:

```powershell
.\svc.cmd install
.\svc.cmd start
```
If GitHub generated shell scripts instead of cmd files, use:

```powershell
.\svc.sh install
.\svc.sh start
```

The runner should have these labels: `self-hosted`, `Windows`, `X64`.

## Local machine requirements

- `D:\development\claude-code\remnawave-backend`
- `D:\development\claude-code\remnawave-frontend`
- Docker Desktop or Docker Engine running on Windows
- Node.js and npm
- Git
- OpenSSH `ssh` and `scp`
- SSH alias `DC1` configured and able to run Docker commands on the production server

Quick checks:

```powershell
docker info
ssh DC1 docker --version
ssh DC1 "test -f /opt/remnawave/docker-compose.yml && echo ok"
```

## First safe run

Open GitHub Actions and run `Local CI Deploy to DC1` manually.

Keep `plan_only` set to `true` for the first run. It will print the image tag, local paths, target host, service name, migration choice, and then stop before build/upload/deploy.

## Real deploy run

When the plan looks right, run the same workflow again with:

- `plan_only`: `false`
- `image_tag`: optional, for example `2.7.4-qr-import-v2`
- `run_migrations`: `true` when backend schema migrations are part of the build

The workflow then:

1. Runs frontend typecheck unless skipped.
2. Builds frontend locally.
3. Copies frontend `dist` into the backend Docker context.
4. Builds `remnawave/backend:<tag>` locally.
5. Smoke tests the local image.
6. Saves the image to a local tar archive.
7. Uploads the tar archive to `DC1:/opt/remnawave`.
8. Backs up compose/env/container metadata under `/opt/remnawave-backups`.
9. Loads the image on `DC1`.
10. Runs Prisma migrations if enabled.
11. Updates only the backend service image in `/opt/remnawave/docker-compose.yml`.
12. Restarts the `remnawave` service and checks container health plus the panel frontend asset.

If the service fails to become healthy, the remote script restores the previous compose file and starts the previous service image again.

## Local manual command

You can run the same flow without GitHub Actions:

```powershell
powershell -ExecutionPolicy Bypass -File D:\development\claude-code\remnawave-backend\scripts\deploy-remnawave-local-ci.ps1 -PlanOnly
```

Real deploy example:

```powershell
powershell -ExecutionPolicy Bypass -File D:\development\claude-code\remnawave-backend\scripts\deploy-remnawave-local-ci.ps1 -ImageTag 2.7.4-local-ci-v1 -RunMigrations
```

## Rollback

Every deploy prints a rollback command and stores backups in `/opt/remnawave-backups/<timestamp>-<image>`.

The rollback command has this shape:

```bash
cp -a '/opt/remnawave-backups/<backup>/docker-compose.before-ci.yml' '/opt/remnawave/docker-compose.yml' && cd '/opt/remnawave' && docker compose -f '/opt/remnawave/docker-compose.yml' up -d 'remnawave'
```
