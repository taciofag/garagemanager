from __future__ import annotations

import asyncio

from ..db import AsyncSessionLocal
from ..repositories.maintenance import VehicleMaintenanceRepository


async def main() -> None:
    async with AsyncSessionLocal() as session:
        repo = VehicleMaintenanceRepository(session)
        created = await repo.ensure_all_series_future(months_ahead=12)
        await session.commit()
        print(f"Ensured recurring maintenance tasks. Created {created} future occurrences.")


if __name__ == "__main__":
    asyncio.run(main())

