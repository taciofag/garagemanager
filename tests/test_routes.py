import pytest
import uuid

from app.services.security import create_access_token


@pytest.mark.anyio
async def test_auth_login(client, admin_user):
    response = await client.post(
        "/auth/login",
        data={"username": admin_user.email, "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.anyio
async def test_vehicle_flow(client, admin_user):
    token = create_access_token(admin_user.email, ["user", "admin"])
    headers = {"Authorization": f"Bearer {token}"}

    seed = uuid.uuid4()
    driver_payload = {
        "id": f"DRV-{seed.hex[:4].upper()}",
        "name": "Driver API",
        "cpf": f"222.222.222-{seed.int % 90 + 10:02d}",
        "phone": "11999990000",
        "start_date": "2024-01-01",
        "weekly_rate": "450.00",
        "commission_pct": "0.05",
        "deposit_held": "500.00",
        "status": "ACTIVE",
    }
    driver_resp = await client.post("/drivers", json=driver_payload, headers=headers)
    assert driver_resp.status_code == 201
    driver_id = driver_resp.json()["id"]

    vehicle_payload = {
        "id": f"CAR-{seed.hex[:6].upper()}",
        "plate": f"API{seed.hex[:4].upper()}",
        "renavam": f"REN{seed.hex[:8].upper()}",
        "vin": f"VIN{uuid.uuid4().hex[:14].upper()}",
        "manufacture_year": 2020,
        "model_year": 2021,
        "make": "API",
        "model": "Test",
        "color": "Black",
        "acquisition_date": "2024-01-01",
        "acquisition_price": "40000.00",
        "odometer_in": 10000,
        "current_driver_id": driver_id,
    }
    vehicle_resp = await client.post("/vehicles", json=vehicle_payload, headers=headers)
    assert vehicle_resp.status_code == 201
    vehicle_id = vehicle_resp.json()["id"]

    list_resp = await client.get("/vehicles", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    update_resp = await client.patch(
        f"/vehicles/{vehicle_id}",
        json={"color": "Silver"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["color"] == "Silver"


@pytest.mark.anyio
async def test_summary_endpoint(client, admin_user):
    token = create_access_token(admin_user.email, ["user", "admin"])
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_vehicles_stock" in data
    assert "rent_collected_ytd" in data
    assert "cash_balance" in data
    assert "outstanding_rent_total" in data
    assert "vehicle_status_breakdown" in data
    assert isinstance(data['vehicle_status_breakdown'], list)
    assert "rent_collection_last_6_months" in data
    assert len(data['rent_collection_last_6_months']) <= 6
    assert "capital_balance_by_partner" in data
