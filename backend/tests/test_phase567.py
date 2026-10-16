from fastapi.testclient import TestClient
from app import main


def payload(**overrides):
    data = {
        "name": "Test User",
        "email": "test.user@example.com",
        "company": "Example Co",
        "service_interest": "AI automation",
        "project_summary": "Automate repetitive customer support workflows.",
        "budget": "₹25,000",
        "timeline": "3 weeks",
        "consent_to_contact": True,
        "lead_source": "manual",
    }
    data.update(overrides)
    return data


def setup_database(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test-leads.sqlite3")
    monkeypatch.delenv("CYNBIT_WEBHOOK_URL", raising=False)
    main._init_lead_db()


def test_lead_crud_analytics_and_integration_status(monkeypatch, tmp_path):
    setup_database(monkeypatch, tmp_path)
    client = TestClient(main.app)

    created = client.post("/api/leads", json=payload())
    assert created.status_code == 201, created.text
    lead = created.json()
    assert lead["id"] > 0
    assert lead["status"] == "new"
    assert lead["lead_source"] == "manual"

    listed = client.get("/api/leads")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["email"] == "test.user@example.com"

    updated = client.patch(f"/api/leads/{lead['id']}/status", json={"status": "qualified"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "qualified"

    analytics = client.get("/api/analytics/overview")
    assert analytics.status_code == 200
    assert analytics.json()["total_leads"] == 1
    assert analytics.json()["qualified_leads"] == 1
    assert analytics.json()["service_demand"][0]["name"] == "AI automation"
    assert analytics.json()["budget_distribution"]

    integration = client.get("/api/integrations/status")
    assert integration.status_code == 200
    assert integration.json()["crm"]["status"] == "ready"
    assert integration.json()["webhook"]["configured"] is False

    events = client.get("/api/integrations/events")
    assert events.status_code == 200
    assert events.json()["count"] >= 2


def test_lead_requires_contact_consent(monkeypatch, tmp_path):
    setup_database(monkeypatch, tmp_path)
    response = TestClient(main.app).post("/api/leads", json=payload(consent_to_contact=False))
    assert response.status_code == 400


def test_lead_status_validation_and_not_found(monkeypatch, tmp_path):
    setup_database(monkeypatch, tmp_path)
    client = TestClient(main.app)
    invalid = client.patch("/api/leads/1/status", json={"status": "made_up"})
    assert invalid.status_code == 422
    missing = client.patch("/api/leads/999/status", json={"status": "qualified"})
    assert missing.status_code == 404


def test_duplicate_lead_submission_is_idempotent(monkeypatch, tmp_path):
    setup_database(monkeypatch, tmp_path)
    client = TestClient(main.app)
    first = client.post("/api/leads", json=payload())
    second = client.post("/api/leads", json=payload())
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert client.get("/api/leads").json()["total"] == 1
