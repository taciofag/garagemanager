from __future__ import annotations

import asyncio
import os

import httpx


async def main() -> None:
    base_url = os.getenv("API_BASE_URL", "http://api:8000")
    admin_email = os.getenv("ADMIN_EMAIL", "admin@garage.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "change-me")

    async with httpx.AsyncClient(base_url=base_url, timeout=30) as client:
        token_response = await client.post(
            "/auth/login",
            data={"username": admin_email, "password": admin_password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_response.raise_for_status()
        token = token_response.json().get("access_token")
        if not token:
            raise RuntimeError("Failed to obtain access token")

        run_response = await client.post(
            "/billing/run",
            headers={"Authorization": f"Bearer {token}"},
        )
        run_response.raise_for_status()
        print("Billing run response:", run_response.json())


if __name__ == "__main__":
    asyncio.run(main())

