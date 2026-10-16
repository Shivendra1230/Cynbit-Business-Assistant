from pydantic import BaseModel, Field, field_validator

class KnowledgeDocumentInput(BaseModel):
    source: str = Field(min_length=1, max_length=240)
    text: str = Field(min_length=20, max_length=200_000)
    category: str = Field(default="general", max_length=80)

    @field_validator("source", "category")
    @classmethod
    def strip_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

class IngestRequest(BaseModel):
    documents: list[KnowledgeDocumentInput] = Field(min_length=1, max_length=100)

class SearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    top_k: int = Field(default=4, ge=1, le=10)

class SearchResult(BaseModel):
    chunk_id: str
    source: str
    category: str
    text: str
    similarity: float
    chunk_index: int | None = None

class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    count: int
    retrieval_mode: str

class ChatHistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=12)

class LeadCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    company: str | None = Field(default=None, max_length=160)
    service_interest: str = Field(min_length=2, max_length=200)
    project_summary: str = Field(min_length=10, max_length=4000)
    budget: str | None = Field(default=None, max_length=100)
    timeline: str | None = Field(default=None, max_length=100)
    consent_to_contact: bool
    lead_source: str = Field(default="website", min_length=2, max_length=80)

    @field_validator("name", "email", "service_interest", "project_summary")
    @classmethod
    def strip_required_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value

    @field_validator("email")
    @classmethod
    def validate_email_shape(cls, value: str) -> str:
        import re
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

class LeadResponse(BaseModel):
    id: int
    name: str
    email: str
    company: str | None = None
    service_interest: str
    project_summary: str
    budget: str | None = None
    timeline: str | None = None
    status: str
    created_at: str
    lead_source: str = "website"
    updated_at: str | None = None

class LeadStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|qualified|contacted|proposal|converted|lost)$")

class LeadListResponse(BaseModel):
    items: list[LeadResponse]
    total: int
    limit: int
    offset: int
