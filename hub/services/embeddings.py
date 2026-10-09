import hashlib
import json
import math
import os
import re
from typing import List
import numpy as np

STOP_WORDS = {
    'what', 'is', 'the', 'for', 'and', 'are', 'you', 'can', 'how', 'many', 'about',
    'with', 'from', 'that', 'this', 'into', 'next', 'does', 'have', 'been', 'will',
    'what', 'when', 'where', 'which', 'who', 'why', 'amount', 'company', 'policy',
    'office', 'guidelines', 'standard', 'rules', 'procedure'
}


class BaseEmbeddingProvider:
    provider_name: str
    model_name: str
    dimension: int

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

    def generate_query_embedding(self, query: str) -> List[float]:
        return self.generate_embeddings([query])[0]


class DeterministicMockEmbeddingProvider(BaseEmbeddingProvider):
    provider_name = "mock"
    model_name = "mock-deterministic-v1"
    dimension = 1536

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self._compute_vector(t) for t in texts]

    def _compute_vector(self, text: str) -> List[float]:
        vector = [0.0] * self.dimension
        words = [
            w for w in re.split(r'\W+', text.lower())
            if len(w) > 2 and w not in STOP_WORDS
        ]

        if not words:
            vector[0] = 1.0
            return vector

        for word in words:
            h = hashlib.md5(word.encode('utf-8')).digest()
            idx1 = int.from_bytes(h[0:2], 'big') % self.dimension
            idx2 = int.from_bytes(h[2:4], 'big') % self.dimension
            idx3 = int.from_bytes(h[4:6], 'big') % self.dimension
            sign = 1.0 if (h[6] % 2 == 0) else -1.0

            vector[idx1] += 1.0 * sign
            vector[idx2] += 0.5 * sign
            vector[idx3] += 0.25

        # Normalize to unit length (L2 norm)
        sum_sq = sum(x * x for x in vector)
        norm = math.sqrt(sum_sq) or 1.0
        return [x / norm for x in vector]


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    provider_name = "openai"
    dimension = 1536

    def __init__(self, api_key: str, model_name: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model_name = model_name

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        import urllib.request
        batch_size = 20
        all_vectors = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            req_data = json.dumps({"input": batch, "model": self.model_name}).encode('utf-8')
            req = urllib.request.Request(
                "https://api.openai.com/v1/embeddings",
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                }
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                sorted_items = sorted(data['data'], key=lambda x: x['index'])
                all_vectors.extend([item['embedding'] for item in sorted_items])

        return all_vectors


def get_embedding_provider() -> BaseEmbeddingProvider:
    provider_type = os.getenv('EMBEDDING_PROVIDER', 'mock').lower()
    api_key = os.getenv('EMBEDDING_API_KEY')

    if provider_type == 'openai' and api_key:
        model = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')
        return OpenAIEmbeddingProvider(api_key, model)

    return DeterministicMockEmbeddingProvider()
