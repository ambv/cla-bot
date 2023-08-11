#!/usr/bin/env python3.7
# This file runs on Debian Buster and needs to be Python 3.7 compatible.

from __future__ import annotations

import asyncio
import os
from urllib.parse import urlparse

from edb_healthcheck import healthcheck
from mv import Minivisor


async def main(mv: Minivisor | None = None) -> None:
    DATABASE_URL = os.environ["DATABASE_URL"]
    EDGEDB_DATABASE = os.environ["EDGEDB_DATABASE"]
    EDGEDB_PASSWORD = urlparse(DATABASE_URL).password
    if mv is None:
        mv = Minivisor()
    await mv.spawn(
        "edgedb-server",
        "--bind-address=127.0.0.1",
        "--emit-server-status=fd://1",
        "--tls-cert-mode=generate_self_signed",
        f"--backend-dsn={DATABASE_URL}",
        with_healthcheck=healthcheck,
        grace_period=180.0,  # some grace for bootstrapping
    )
    password_command = f"""
        alter role edgedb {{
            set password := '{EDGEDB_PASSWORD}';
        }};
    """
    await mv.once(
        "edgedb",
        "--admin",
        "--host=/var/run/edgedb/.s.EDGEDB.admin.5656",
        input=password_command.encode(),
    )
    if EDGEDB_DATABASE != "edgedb":
        await mv.once(
            "edgedb",
            "--admin",
            "--host=/var/run/edgedb/.s.EDGEDB.admin.5656",
            "database",
            "create",
            EDGEDB_DATABASE,
            require_clean_return_code=False,
        )
    await mv.once(
        "edgedb",
        "instance",
        "link",
        "--non-interactive",
        "--trust-tls-cert",
        f"--dsn=edgedb://edgedb:{EDGEDB_PASSWORD}@127.0.0.1:5656/{EDGEDB_DATABASE}",
        "cla",
    )
    await mv.once(
        "edgedb",
        "-I",
        "cla",
        "migrate",
    )
    await mv.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
