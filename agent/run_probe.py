#!/usr/bin/env python3
"""Zero-install entry point: `python3 agent/run_probe.py [options]`.

Requires only CPython 3.10+ from the standard library. The contracts mode additionally needs the
repository's Node dependencies installed, because it drives the real Zod gates through `tsx`.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from moverealm_probe.cli import main  # noqa: E402 - path setup must run first

if __name__ == "__main__":
    raise SystemExit(main())
