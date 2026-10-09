import pytest
from hub.services.extraction import normalize_content, parse_markdown_sections
from hub.services.chunking import chunk_document_sections, estimate_token_count
from hub.services.embeddings import DeterministicMockEmbeddingProvider
from hub.services.citations import validate_and_extract_citations
from hub.services.rbac import has_minimum_role, can_access_document
from hub.services.retrieval import RetrievalResult
from hub.models import OrgRole, DocumentAccessScope


def test_text_normalization():
    raw = "Heading 1\r\n\r\n\r\nSome    spaced    text.\r\nNext line."
    output = normalize_content(raw)
    assert "Some spaced text." in output
    assert "\r" not in output
    assert "\n\n\n" not in output


def test_markdown_section_parser():
    md = "# Main Policy\nIntro text here.\n\n## Section 1: PTO\n20 days per year.\n\n## Section 2: Sick Leave\n10 days per year."
    sections = parse_markdown_sections(md)
    assert len(sections) == 3
    assert sections[0].heading_path == "Main Policy"
    assert sections[1].heading_path == "Section 1: PTO"
    assert "20 days per year." in sections[1].content


def test_chunking_with_heading_preservation():
    sections = parse_markdown_sections("# Onboarding\nWelcome!\n\n## Equipment\nMacBook Pro 16 or Dell XPS 15 provided with monitor.")
    chunks = chunk_document_sections(sections, max_tokens=15, overlap_tokens=3)
    assert len(chunks) >= 2
    assert chunks[0].heading_path == "Onboarding"
    assert chunks[1].heading_path == "Equipment"


def test_deterministic_embedding_provider():
    provider = DeterministicMockEmbeddingProvider()
    vectors = provider.generate_embeddings(["Corporate password complexity standard"])
    assert len(vectors) == 1
    assert len(vectors[0]) == 1536

    # Unit norm check
    norm = sum(x * x for x in vectors[0]) ** 0.5
    assert abs(norm - 1.0) < 1e-4


def test_citation_validation():
    valid_id = "11111111-1111-1111-1111-111111111111"
    fake_id = "99999999-9999-9999-9999-999999999999"

    mock_retrieved = [
        RetrievalResult(
            chunk_id=valid_id,
            document_id="doc-1",
            version_id="v-1",
            document_title="PTO Policy",
            heading_path="Rollover",
            page_number=1,
            content="A maximum of 5 unused PTO days may be rolled over.",
            similarity=0.9,
            token_count=20,
        )
    ]

    answer = f"You can roll over 5 days [CHUNK_ID: {valid_id}]. Fake bonus [CHUNK_ID: {fake_id}]."
    val = validate_and_extract_citations(answer, mock_retrieved)

    assert len(val.citations) == 1
    assert val.citations[0].chunk_id == valid_id
    assert fake_id in val.invalid_citation_ids
    assert valid_id not in val.cleaned_answer


def test_rbac_hierarchy():
    assert has_minimum_role(OrgRole.OWNER, OrgRole.ADMIN) is True
    assert has_minimum_role(OrgRole.ADMIN, OrgRole.EDITOR) is True
    assert has_minimum_role(OrgRole.EDITOR, OrgRole.MEMBER) is True
    assert has_minimum_role(OrgRole.MEMBER, OrgRole.EDITOR) is False


def test_gemini_embedding_provider_mocked(monkeypatch):
    from hub.services.embeddings import GoogleGeminiEmbeddingProvider, get_embedding_provider

    class MockEmbedContentResponse:
        def __init__(self, values):
            class Emb:
                def __init__(self, v):
                    self.values = v
            self.embeddings = [Emb(values)]

    class MockGenaiClient:
        def __init__(self, api_key):
            self.api_key = api_key
            self.models = self

        def embed_content(self, model, contents):
            return MockEmbedContentResponse([0.1] * 768)

    monkeypatch.setattr('google.genai.Client', MockGenaiClient)
    provider = GoogleGeminiEmbeddingProvider(api_key="fake-gemini-key")
    res = provider.generate_embeddings(["test search query"])
    assert len(res) == 1
    assert len(res[0]) == 768
    assert res[0][0] == 0.1

    monkeypatch.setenv("EMBEDDING_PROVIDER", "google")
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    p = get_embedding_provider()
    assert isinstance(p, GoogleGeminiEmbeddingProvider)

