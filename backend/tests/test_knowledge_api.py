from fastapi.testclient import TestClient
from app import main

class FakeStore:
    _records = [{"chunk_id":"x"}]
    def search(self, query, top_k=4):
        return [{"chunk_id":"chunk-1","source":"test-source","category":"services","text":"Cynbit offers AI automation services.","similarity":0.81}][:top_k]
    def ingest(self, documents):
        return {"documents_received":len(documents),"chunks_added":1,"total_chunks":2}

def test_search_returns_sources(monkeypatch):
    monkeypatch.setattr(main, "store", FakeStore())
    response = TestClient(main.app).post("/api/knowledge/search", json={"query":"How can Cynbit help with AI automation?","top_k":3})
    assert response.status_code == 200
    assert response.json()["results"][0]["source"] == "test-source"
    assert response.json()["retrieval_mode"] == "local-onnx-embedding-cosine-similarity"

def test_search_rejects_short_query():
    response = TestClient(main.app).post("/api/knowledge/search", json={"query":"a"})
    assert response.status_code == 422

def test_ingest_counts(monkeypatch):
    monkeypatch.setattr(main, "store", FakeStore())
    response = TestClient(main.app).post("/api/knowledge/ingest", json={"documents":[{"source":"test doc","category":"services","text":"This is a long enough test document to pass validation."}]})
    assert response.status_code == 200
    assert response.json()["chunks_added"] == 1
