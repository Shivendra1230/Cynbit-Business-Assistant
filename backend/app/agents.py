"""Deterministic agent routing and response-quality checks for Cynbit."""
from __future__ import annotations

import re
from dataclasses import dataclass

@dataclass(frozen=True)
class Route:
    agent: str
    reason: str

LEAD_TERMS = (
    "i want to hire", "hire cynbit", "work with cynbit", "get a quote",
    "request a quote", "project estimate", "build an app", "develop an app",
    "need a website", "need an app", "need automation", "need ai agent",
    "interested in your services", "contact sales", "start a project",
    "business inquiry", "proposal", "pricing for", "how can i engage",
)
SUPPORT_TERMS = (
    "not working", "doesn't work", "does not work", "error", "issue",
    "problem", "troubleshoot", "help with", "support", "bug", "failed",
)
GENERAL_PREFIXES = ("what is ", "what are ", "explain ", "define ", "how does ", "how do ", "why does ", "teach me ", "difference between ")
EXPLICIT_COMPANY_TERMS = ("cynbit", "our services", "your services", "our products", "your products", "company information", "what do you offer")

COMPANY_TERMS = (
    "cynbit", "service", "services", "product", "products", "studio", "revio",
    "tenantease", "bitelevate", "pricing", "price", "cost", "contact", "company",
    "technology", "tech stack", "automation", "cloud", "software", "api", "crm",
    "delivery", "guarantee", "what do you offer", "what can you do",
)

def route_message(message: str) -> Route:
    text = re.sub(r"\s+", " ", message.casefold()).strip()
    if any(term in text for term in LEAD_TERMS):
        return Route("lead_agent", "Potential service inquiry or project intent")
    if text.startswith(GENERAL_PREFIXES) and not any(term in text for term in EXPLICIT_COMPANY_TERMS):
        return Route("general_assistant", "General educational question")
    if any(term in text for term in SUPPORT_TERMS):
        return Route("support_agent", "Troubleshooting or support intent")
    if any(term in text for term in COMPANY_TERMS):
        return Route("knowledge_agent", "Company information request")
    return Route("general_assistant", "General question; keep company claims evidence-bound")

def quality_check(answer: str, evidence_present: bool, company_question: bool) -> tuple[str, bool, str]:
    """Conservative deterministic gate; does not pretend to prove factual correctness."""
    cleaned = (answer or "").strip()
    if not cleaned:
        return ("I couldn't produce a reliable answer just now. Please try again.", False, "empty_answer")
    if company_question and not evidence_present:
        return (
            "I couldn't find sufficiently relevant information in Cynbit's indexed knowledge to answer that reliably. Please confirm this detail with the Cynbit team.",
            False,
            "missing_company_evidence",
        )
    # Prevent the model from claiming external actions that the application cannot perform.
    if re.search(r"\b(i have (?:sent|created|booked|contacted|submitted)|i've (?:sent|created|booked|contacted|submitted))\b", cleaned, re.I):
        cleaned += "\n\nNote: I can't perform external actions from this chat unless a connected workflow explicitly supports them."
    return cleaned, True, "passed_basic_checks"
