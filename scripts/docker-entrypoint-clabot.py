#!/usr/bin/env python3.7
# This file runs on Debian Buster and needs to be Python 3.7 compatible.

from __future__ import annotations

import asyncio
import asyncio.subprocess
import ctypes
import ctypes.util
import os
import shutil
import signal
import sys
from urllib.parse import urlparse

from edb_healthcheck import healthcheck
from mv import Minivisor


def ensure_dead_with_parent():
    """A last resort measure to make sure this process dies with its parent.
    Defensive programming for unhandled errors.
    """
    PR_SET_PDEATHSIG = 1  # include/uapi/linux/prctl.h
    libc = ctypes.CDLL(ctypes.util.find_library("c"))
    libc.prctl(PR_SET_PDEATHSIG, signal.SIGKILL)


def untangle_github_rsa_private_key() -> None:
    """Heroku sort of supports multiline config vars. Docker .env does not."""

    GITHUB_RSA_PRIVATE_KEY_SOURCE = os.environ["GITHUB_RSA_PRIVATE_KEY_SOURCE"]
    GITHUB_RSA_KEY_PATH = "/home/github-private-key.pem"
    os.environ["GITHUB_RSA_PRIVATE_KEY"] = GITHUB_RSA_KEY_PATH

    with open(GITHUB_RSA_KEY_PATH, "w") as key_file:
        source = GITHUB_RSA_PRIVATE_KEY_SOURCE
        if source[0] == '"':
            import ast

            parsed = ast.parse(source, mode="eval").body
            if isinstance(parsed, ast.Constant):
                # Python 3.9+
                source = parsed.value
            elif isinstance(parsed, ast.Str):
                # Python 3.7
                source = parsed.s
            else:
                raise TypeError(f"{type(parsed)}")
        key_file.write(source)


def matches(cmd: str, sub: str) -> bool:
    return cmd == sub or f"/bin/sh -c {sub}" in cmd


async def main() -> None:
    PORT = os.environ["PORT"]
    DATABASE_URL = os.environ["DATABASE_URL"]
    EDGEDB_PASSWORD = urlparse(DATABASE_URL).password
    mv = Minivisor()

    # Figure out if what the user wants is the new deployment setup.
    # This is more complex than it's got to be because Heroku tries to inject some
    # log-streaming BS through shell.
    new_release = False
    argv = sys.argv[1:]
    if argv[0:2] == ["/bin/sh", "-c"]:
        argv = argv[2:]

    if len(argv) > 1:
        await mv.out.put(b"Invalid entrypoint sub-command: " + repr(argv).encode())
        await mv.shutdown()
        return

    if len(argv) == 1:
        cmd = argv[0]
        if matches(cmd, "deployment"):
            new_release = True
        elif matches(cmd, "default"):
            new_release = False
        elif matches(cmd, "bash"):
            await mv.shutdown()
            # start the shell
            bash_executable = shutil.which("bash")
            if not bash_executable:
                raise RuntimeError("Missing bash executable")
            os.execv(bash_executable, ('bash',))
        else:
            await mv.out.put(b"Invalid entrypoint sub-command: " + repr(cmd).encode())
            await mv.shutdown()
            return

    if new_release:
        import deployment

        await mv.out.put(b"Running deployment tasks for a new release...")
        await deployment.main(mv)
        return

    await mv.spawn(
        "edgedb-server",
        "--bind-address=0.0.0.0",
        "--emit-server-status=fd://1",
        "--tls-cert-mode=generate_self_signed",
        "--compiler-pool-mode=on_demand",
        f"--backend-dsn={DATABASE_URL}",
        with_healthcheck=healthcheck,
        grace_period=20.0,
    )

    os.environ["EDGEDB_HOST"] = "127.0.0.1"
    os.environ["EDGEDB_PORT"] = "5656"
    os.environ["EDGEDB_PASSWORD"] = EDGEDB_PASSWORD
    os.environ["ORGANIZATION_NAME"] = "python"
    os.environ["ORGANIZATION_DISPLAY_NAME"] = "Python Software Foundation"

    untangle_github_rsa_private_key()

    await mv.spawn("yarn", "next", "start", "-p", PORT)
    await mv.wait_until_any_terminates()


if __name__ == "__main__":
    ensure_dead_with_parent()
    asyncio.run(main())
