import json
import re
import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from fastembed import TextEmbedding

from app.config import get_settings

_LOCK = threading.RLock()


def split_text(text: str, max_chars: int = 850, overlap: int = 120) -> list[str]:
    """Split text into readable, overlapping chunks without corrupting markup."""
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    if not cleaned:
        return []

    words = cleaned.split()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for word in words:
        addition = len(word) + (1 if current else 0)
        if current and current_len + addition > max_chars:
            chunks.append(" ".join(current))
            overlap_words: list[str] = []
            overlap_len = 0
            for old in reversed(current):
                extra = len(old) + (1 if overlap_words else 0)
                if overlap_words and overlap_len + extra > overlap:
                    break
                if not overlap_words and len(old) > overlap:
                    break
                overlap_words.insert(0, old)
                overlap_len += extra
            current = overlap_words
            current_len = len(" ".join(current))

        if current and current_len + len(word) + 1 > max_chars:
            chunks.append(" ".join(current))
            current = []
            current_len = 0

        current.append(word)
        current_len += len(word) + (1 if len(current) > 1 else 0)

    if current:
        tail = " ".join(current)
        if not chunks or chunks[-1] != tail:
            chunks.append(tail)

    return [chunk for chunk in chunks if chunk.strip()]


class SemanticKnowledgeStore:
    """Persistent semantic index using FastEmbed/ONNX (no PyTorch dependency)."""

    def __init__(self, index_path: Path | None = None, model_name: str | None = None):
        settings = get_settings()
        self.index_path = Path(index_path or settings.resolved_index_path)
        configured_model = model_name or settings.embedding_model
        # FastEmbed's model registry uses this exact model identifier.
        self.model_name = configured_model or "sentence-transformers/all-MiniLM-L6-v2"
        self._model: TextEmbedding | None = None
        self._records: list[dict[str, Any]] = []
        self._embeddings: np.ndarray | None = None
        self._load_index()

    def _get_model(self) -> TextEmbedding:
        if self._model is None:
            self._model = TextEmbedding(model_name=self.model_name)
        return self._model

    @staticmethod
    def _normalize(matrix: np.ndarray) -> np.ndarray:
        matrix = np.asarray(matrix, dtype=np.float32)
        if matrix.ndim == 1:
            matrix = matrix.reshape(1, -1)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms

    def _load_index(self) -> None:
        if not self.index_path.exists():
            return
        try:
            data = json.loads(self.index_path.read_text(encoding="utf-8"))
            records = data.get("records", [])
            vectors = data.get("embeddings", [])
            if records and vectors and len(records) == len(vectors):
                matrix = self._normalize(np.asarray(vectors, dtype=np.float32))
                if matrix.shape[0] == len(records):
                    self._records = records
                    self._embeddings = matrix
        except (OSError, ValueError, TypeError, KeyError):
            self._records, self._embeddings = [], None

    def _save_index(self) -> None:
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "records": self._records,
            "embeddings": self._embeddings.tolist() if self._embeddings is not None else [],
        }
        temp = self.index_path.with_suffix(self.index_path.suffix + ".tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        temp.replace(self.index_path)

    def ingest(self, documents: list[dict[str, str]]) -> dict[str, int]:
        records: list[dict[str, Any]] = []
        for doc in documents:
            text = str(doc.get("text", "")).strip()
            if not text:
                continue
            source = str(doc.get("source", "Uploaded document")).strip() or "Uploaded document"
            category = str(doc.get("category", "general")).strip() or "general"
            for idx, chunk in enumerate(split_text(text)):
                records.append({
                    "chunk_id": str(uuid.uuid4()),
                    "source": source,
                    "category": category,
                    "chunk_index": idx,
                    "text": chunk,
                })

        if not records:
            return {
                "documents_received": len(documents),
                "chunks_added": 0,
                "total_chunks": len(self._records),
            }

        model = self._get_model()
        vectors = self._normalize(np.asarray(list(model.embed([r["text"] for r in records])), dtype=np.float32))

        with _LOCK:
            self._records.extend(records)
            self._embeddings = vectors if self._embeddings is None else np.vstack((self._embeddings, vectors))
            self._save_index()

        return {
            "documents_received": len(documents),
            "chunks_added": len(records),
            "total_chunks": len(self._records),
        }

    def search(self, query: str, top_k: int = 4) -> list[dict[str, Any]]:
        query = str(query or "").strip()
        if not query or not self._records or self._embeddings is None:
            return []
        model = self._get_model()
        query_vectors = self._normalize(np.asarray(list(model.query_embed([query])), dtype=np.float32))
        if query_vectors.shape[1] != self._embeddings.shape[1]:
            raise ValueError("Embedding dimensions differ; rebuild the knowledge index using the configured model.")
        scores = self._embeddings @ query_vectors[0]
        limit = max(1, min(int(top_k), 20))
        indices = np.argsort(scores)[::-1][:limit]
        return [
            {**self._records[int(i)], "similarity": round(float(scores[int(i)]), 4)}
            for i in indices
        ]


def build_seed_documents() -> list[dict[str, str]]:
    return [
        {"source": "Cynbit company overview", "category": "company", "text": "Cynbit Technologies is a technology company based in Jaipur, Rajasthan, India. It focuses on AI, software engineering, automation, SaaS products and cloud infrastructure. Cynbit builds technology for businesses, organizations and developers, including custom software, AI systems and automation. Its approach is to understand the problem first, build for real use, automate where useful, keep systems maintainable and build for scale."},
        {"source": "Cynbit AI and automation services", "category": "services", "text": "Cynbit AI and automation work includes AI agents, LLM applications, AI-powered workflows, voice AI, business process automation and AI integrations. The goal is to help businesses automate repetitive work, improve decision-making and build better workflows. Specific availability, pricing, delivery timelines and guarantees must be confirmed by Cynbit; they are not specified in this knowledge source."},
        {"source": "Cynbit software engineering services", "category": "services", "text": "Cynbit software engineering services include web applications, mobile applications, SaaS platforms, backend systems, APIs, enterprise software and custom software solutions. Product development can cover planning, architecture, development, deployment and improvement."},
        {"source": "Cynbit cloud and infrastructure services", "category": "services", "text": "Cynbit cloud and infrastructure services include cloud architecture, AWS and Azure, DevOps, CI/CD, Docker, Kubernetes, infrastructure automation and cloud migration. Specific scope should be confirmed against each client's requirements."},
        {"source": "Cynbit digital systems services", "category": "services", "text": "Cynbit digital systems work includes CRM automation, technical SEO, business automation, data and analytics, digital platforms and performance optimization."},
        {"source": "Cynbit Studio product", "category": "products", "text": "Cynbit Studio is described as an AI-powered learning and career readiness platform. It helps students and developers build practical skills through structured learning, projects, assessments, AI mentorship, mock interviews and career tools. Areas include AI-powered learning paths, practical coding tasks, automated evaluation, skill assessments and career preparation. Details: https://www.cynbit.in/products."},
        {"source": "Revio product", "category": "products", "text": "Revio is described as an AI-powered reputation and review management platform. Its stated areas include review management, AI-assisted responses, sentiment analysis, reputation monitoring, multi-location management and business analytics."},
        {"source": "TenantEase product", "category": "products", "text": "TenantEase is described as a property and tenant management platform. Its stated areas include property management, tenant management, rent tracking, payment records, automated reminders and occupancy information."},
        {"source": "BitElevate initiative", "category": "products", "text": "BitElevate is Cynbit's practical technology education and industry-readiness initiative. It focuses on moving from learning concepts to building real systems through projects, technical tasks, mentorship, assessments and career preparation. Areas include software development, web development, AI and machine learning, data science, data analytics, cloud and DevOps."},
        {"source": "Cynbit technology stack", "category": "technology", "text": "Cynbit's described technology stack includes Python, TypeScript, JavaScript, Go, Rust, Java and C++; React, Next.js, FastAPI, Django, Node.js and NestJS; OpenAI, LangChain, PyTorch and TensorFlow; PostgreSQL, MongoDB, Redis, Supabase and Neo4j; AWS, Azure, Docker, Kubernetes and Terraform."},
        {"source": "Cynbit contact and links", "category": "contact", "text": "Cynbit Technologies website: https://www.cynbit.in. Products: https://www.cynbit.in/products. Services: https://www.cynbit.in/services. BitElevate: https://www.cynbit.in/bitelevate. Contact: https://www.cynbit.in/contact. The supplied company brief lists Jaipur, Rajasthan, India."},
    ]
