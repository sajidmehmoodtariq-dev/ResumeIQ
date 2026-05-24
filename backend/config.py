import os

from dotenv import load_dotenv

load_dotenv()

# Scoring weights — must sum to 1.0.
# semantic:       cosine similarity between full resume and JD embeddings
# skill_coverage: fraction of JD skills present in the resume
WEIGHTS = {
    "semantic":       0.60,
    "skill_coverage": 0.40,
}

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "resume_matcher")
MONGO_USERS_COLLECTION = os.getenv("MONGO_USERS_COLLECTION", "users")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "10080"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
