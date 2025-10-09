from __future__ import annotations

import asyncio

from ..db import AsyncSessionLocal
from ..services.maintenance import MaintenanceService


async def main() -> None:
    async with AsyncSessionLocal() as session:
        service = MaintenanceService(session)
        await service.ensure_for_filters()
        await session.commit()
        print("Ensured recurring maintenance tasks within horizon.")


if __name__ == "__main__":
    asyncio.run(main())
