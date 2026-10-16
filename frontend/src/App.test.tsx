
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  searchKnowledge: vi.fn(),
  sendChat: vi.fn(),
  getAnalytics: vi.fn(),
  getIntegrationEvents: vi.fn(),
  getIntegrationStatus: vi.fn(),
  listLeads: vi.fn(),
  submitLead: vi.fn(),
  testWebhook: vi.fn(),
  updateLeadStatus: vi.fn(),
}));

vi.mock("./api", () => mocks);

function setupApiMocks() {
  mocks.getHealth.mockResolvedValue({
    status: "ok",
    service: "cynbit-ai-business-assistant-api",
    version: "0.2.0",
  });

  mocks.searchKnowledge.mockResolvedValue({
    query: "AI automation",
    count: 1,
    retrieval_mode: "sentence-embedding-cosine-similarity",
    results: [
      {
        chunk_id: "1",
        source: "Cynbit AI services",
        category: "services",
        text: "Cynbit provides AI automation services.",
        similarity: 0.82,
      },
    ],
  });

  mocks.sendChat.mockResolvedValue({
    answer: "Cynbit provides AI automation services.",
    sources: [],
    agent: "knowledge_agent",
    retrieval_mode: "local-onnx-rag",
  });

  mocks.getAnalytics.mockResolvedValue({
    total_leads: 0,
    qualified_leads: 0,
    converted_leads: 0,
    conversion_rate: 0,
    monthly_leads: [],
    status_breakdown: [],
    service_demand: [],
    budget_distribution: [],
  });

  mocks.listLeads.mockResolvedValue({
    items: [],
    total: 0,
  });

  mocks.getIntegrationStatus.mockResolvedValue({
    webhook: { configured: false },
    email: { configured: false },
    notifications: "Webhook notifications are optional.",
  });

  mocks.getIntegrationEvents.mockResolvedValue({
    items: [],
  });

  mocks.submitLead.mockResolvedValue({});
  mocks.updateLeadStatus.mockResolvedValue({});
  mocks.testWebhook.mockResolvedValue({
    message: "Webhook test completed.",
  });
}

describe("Cynbit knowledge workspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupApiMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the workspace and semantic search", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /turn company knowledge/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("textbox", {
        name: /search cynbit knowledge/i,
      })
    ).toBeInTheDocument();
  });

  it("renders the workspace without crashing during the health check", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /turn company knowledge/i,
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", {
          name: /search cynbit knowledge/i,
        })
      ).toBeInTheDocument();
    });
  });

  it("submits semantic search and renders source evidence", async () => {
    render(<App />);

    const searchInput = screen.getByRole("textbox", {
      name: /search cynbit knowledge/i,
    });

    fireEvent.change(searchInput, {
      target: { value: "AI automation" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /^search/i,
      })
    );

    await waitFor(() => {
      expect(mocks.searchKnowledge).toHaveBeenCalledWith(
        "AI automation"
      );

      expect(
        screen.getByText("Cynbit AI services")
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Cynbit provides AI automation services."
        )
      ).toBeInTheDocument();
    });
  });

  it("renders CRM safely when integrations are not configured", async () => {
    mocks.getIntegrationStatus.mockResolvedValue({
      notifications: "Notifications are optional.",
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText("Outbound webhook")
      ).toBeInTheDocument();

      expect(
        screen.getByText("Email provider")
      ).toBeInTheDocument();
    });
  });
});
