#!/usr/bin/env python3

"""
Deduplicate the database's entries that should be the same normalized email.
"""

from __future__ import annotations

import atexit
import os
import time
from urllib.parse import urlparse

from dotenv import load_dotenv
import edgedb
from edgedb.pgproto import pgproto
from rich.console import Console
from rich.progress import Progress
from rich.prompt import Prompt


load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
EDGEDB_PASSWORD = urlparse(DATABASE_URL).password


class RollBack(Exception):
    """Indicates we want to roll a transaction back."""


console = Console()
print = console.print


print("Connecting to EdgeDB", end="... ")
con = edgedb.create_client(
    host="localhost",
    user="edgedb",
    database="edgedb",
    password=EDGEDB_PASSWORD,
)
print("connected.")
atexit.register(con.close)

NormEmail = str
ID = pgproto.UUID
seen: dict[NormEmail, set[ID]] = {}
to_delete: set[ID] = set()

with Progress(console=console, transient=True) as progress:
    result = con.query(
        """
        SELECT ContributorLicenseAgreement {
            id,
            email,
            norm_email := normalize_email(.email)
        }
        ORDER BY .creation_time;
        """,
    )
    task = progress.add_task("Processing", total=len(result))
    for elem in result:
        if elem.norm_email in seen:
            to_delete.add((elem.id, elem.norm_email))
        seen.setdefault(elem.norm_email, set()).add(elem.id)
        progress.advance(task)

print(f"Seen {len(seen)} normalized emails.")
print(f"Should delete {len(to_delete)} duplicates.")

try:
    for tx in con.transaction():
        with tx:
            with Progress(console=console, transient=True) as progress:
                task = progress.add_task("Deleting duplicates", total=len(to_delete))
                for elem_id, elem_email in sorted(to_delete):
                    print(elem_email)
                    tx.query(
                        """
                        DELETE ContributorLicenseAgreement
                        FILTER .id = <uuid>$id;
                        """,
                        id=elem_id,
                    )
                    progress.advance(task)
            if to_delete:
                answer = Prompt.ask("Commit deletion? (y/N)")
                if answer.lower() != "y":
                    print("Aborting.")
                    raise RollBack
except RollBack:
    pass
