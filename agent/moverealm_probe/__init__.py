"""MoveRealm Safety Probe — an adversarial agent for the Movement Director contracts.

The agent generates adversarial scene, quest-plan, and adaptation candidates, asks the *real*
production Zod gates to rule on them, and compares each verdict against an independently written
restatement of MoveRealm's documented movement rules. Disagreements are reported as findings.

It is an evaluation tool. It never approves, rewrites, or executes a quest, and it produces no
participant data, media, or health inference.
"""

__all__ = ["__version__", "SCHEMA_VERSION"]

__version__ = "1.0.0"
SCHEMA_VERSION = "1.0.0"
