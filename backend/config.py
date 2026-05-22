# Scoring weights — must sum to 1.0.
# semantic:       cosine similarity between full resume and JD embeddings
# skill_coverage: fraction of JD skills present in the resume
WEIGHTS = {
    "semantic":       0.60,
    "skill_coverage": 0.40,
}
