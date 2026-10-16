from app.knowledge import build_seed_documents, split_text

def test_split_text_returns_chunks():
    chunks = split_text("Cynbit builds AI systems. " * 100, max_chars=120, overlap=20)
    assert chunks
    assert all(chunk.strip() for chunk in chunks)

def test_seed_knowledge_covers_products_and_services():
    sources = {doc["source"] for doc in build_seed_documents()}
    assert "Cynbit Studio product" in sources
    assert "Revio product" in sources
    assert "TenantEase product" in sources
    assert "Cynbit AI and automation services" in sources
