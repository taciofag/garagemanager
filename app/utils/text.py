from __future__ import annotations

import re

_slug_pattern = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Convert arbitrary text into a slug suitable for identifiers."""
    value = value.strip().lower()
    value = _slug_pattern.sub("-", value)
    return value.strip("-")

