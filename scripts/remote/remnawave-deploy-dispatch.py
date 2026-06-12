#!/usr/bin/env python3
import os
import re
import shlex
import sys


DEPLOY_SCRIPT = "/usr/local/sbin/remnawave-cloud-deploy"
GHCR_LOGIN_SCRIPT = "/usr/local/sbin/remnawave-ghcr-login"


def deny(message: str, code: int = 126) -> None:
    print(f"remnawave deploy command denied: {message}", file=sys.stderr)
    raise SystemExit(code)


def validate_image(value: str) -> None:
    if not re.fullmatch(r"ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+:[A-Za-z0-9_.-]+", value):
        deny("invalid image")


def validate_panel_url(value: str) -> None:
    if not re.fullmatch(r"https://panel\.5555557\.xyz/?", value):
        deny("invalid panel URL")


def main() -> None:
    original_command = os.environ.get("SSH_ORIGINAL_COMMAND", "").strip()

    if not original_command:
        deny("missing command")

    try:
        argv = shlex.split(original_command)
    except ValueError as exc:
        deny(f"invalid command quoting: {exc}")

    if argv == ["probe"]:
        print("remnawave-deploy ok")
        return

    if len(argv) == 2 and argv[0] == "ghcr-login":
        username = argv[1]

        if not re.fullmatch(r"[A-Za-z0-9_.-]+", username):
            deny("invalid GHCR username")

        os.execvp("sudo", ["sudo", "-n", GHCR_LOGIN_SCRIPT, username])

    if len(argv) == 8 and argv[0] == "deploy":
        _, image, app_dir, compose_file, service, network, panel_url, run_migrations = argv

        validate_image(image)

        if app_dir != "/opt/remnawave":
            deny("invalid app dir")

        if compose_file != "/opt/remnawave/docker-compose.yml":
            deny("invalid compose file")

        if service != "remnawave":
            deny("invalid service")

        if network != "remnawave-network":
            deny("invalid network")

        validate_panel_url(panel_url)

        if run_migrations not in {"true", "false"}:
            deny("invalid migration flag")

        os.execvp(
            "sudo",
            [
                "sudo",
                "-n",
                DEPLOY_SCRIPT,
                image,
                app_dir,
                compose_file,
                service,
                network,
                panel_url,
                run_migrations,
            ],
        )

    deny("unsupported command")


if __name__ == "__main__":
    main()
