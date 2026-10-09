import pytest
from hub.models import Conversation
from hub.services.seed import seed_demo_database, DEMO_ORG_ID, DEMO_USERS
from hub.services.rag import execute_rag_pipeline


@pytest.fixture(autouse=True)
def setup_db(db):
    seed_demo_database()


EVAL_CASES = [
    {
        "id": "EVAL-01",
        "question": "How many days of PTO can I roll over into the next calendar year and what is the deadline?",
        "expected_keywords": ["5", "march 31"],
        "expect_abstention": False,
        "user_id": DEMO_USERS["engineer"]["id"],
    },
    {
        "id": "EVAL-02",
        "question": "What is the required response time for Priority 1 urgent tickets?",
        "expected_keywords": ["15 minutes", "priority 1"],
        "expect_abstention": False,
        "user_id": DEMO_USERS["support"]["id"],
    },
    {
        "id": "EVAL-03",
        "question": "What is the home office setup stipend for remote employees?",
        "expected_keywords": ["1,000", "stipend"],
        "expect_abstention": False,
        "user_id": DEMO_USERS["engineer"]["id"],
    },
    {
        "id": "EVAL-04",
        "question": "What is the company policy on bringing pets or dogs to the office and pet medical insurance?",
        "expected_keywords": ["couldn't find enough information"],
        "expect_abstention": True,
        "user_id": DEMO_USERS["engineer"]["id"],
    },
    {
        "id": "EVAL-05",
        "question": "What is the executive leadership equity vesting schedule and bonus formula?",
        "expected_keywords": ["couldn't find enough information"],
        "expect_abstention": True,
        "user_id": DEMO_USERS["engineer"]["id"],  # Regular member -> restricted doc -> abstention
    },
    {
        "id": "EVAL-06",
        "question": "What is the executive leadership equity vesting schedule and bonus formula?",
        "expected_keywords": ["vesting", "bonus"],
        "expect_abstention": False,
        "user_id": DEMO_USERS["admin"]["id"],  # Admin -> authorized
    },
]


@pytest.mark.parametrize("case", EVAL_CASES, ids=lambda c: c["id"])
def test_rag_evaluation_benchmarks(db, case):
    conv = Conversation.objects.create(
        organization_id=DEMO_ORG_ID,
        user_id=case["user_id"],
        title=f"Eval {case['id']}"
    )

    response = execute_rag_pipeline(
        org_id=DEMO_ORG_ID,
        user_id=case["user_id"],
        conversation_id=str(conv.id),
        question=case["question"],
    )

    if case["expect_abstention"]:
        assert response["insufficient_evidence"] is True
        assert "couldn't find enough information" in response["answer"].lower()
    else:
        assert response["insufficient_evidence"] is False
        assert len(response["citations"]) > 0
        answer_lower = response["answer"].lower()
        for kw in case["expected_keywords"]:
            assert kw.lower() in answer_lower
