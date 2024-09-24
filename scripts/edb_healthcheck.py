#!/usr/bin/env python3.7
# This file runs on Debian Buster and needs to be Python 3.7 compatible.
from __future__ import annotations

import asyncio
import pathlib
import shutil


socket_dir = pathlib.Path("/run/edgedb")
admin_socket = socket_dir / ".s.EDGEDB.admin.5656"


async def healthcheck() -> None:
    if not socket_dir.is_dir():
        raise RuntimeError(f"{socket_dir} does not exist")

    if not admin_socket.is_socket():
        raise RuntimeError(f"Socket {admin_socket} not present")

    exe = shutil.which("edgedb")
    if not exe:
        raise RuntimeError("Missing `edgedb` client executable")

    args = ["--admin", f"--host={admin_socket}"]
    command = "SELECT 1;"
    proc = await asyncio.create_subprocess_exec(
        exe,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        stdin=asyncio.subprocess.PIPE,
    )

    stdout_b, stderr_b = await proc.communicate(command.encode())
    stdout = "" if stdout_b is None else stdout_b.decode().strip()
    stderr = "" if stderr_b is None else stderr_b.decode().strip()

    if proc.returncode != 0:
        msg = f"`edgedb` returned with code {proc.returncode}:"
        if stderr:
            msg += "\n" + stderr
        if stdout:
            msg += "\n" + stdout
        raise RuntimeError(msg)

    if stdout != "1":
        msg = "`edgedb` returned unexpected result:"
        if stderr:
            msg += "\n" + stderr
        if stdout:
            msg += "\n" + stdout
        raise RuntimeError(msg)
