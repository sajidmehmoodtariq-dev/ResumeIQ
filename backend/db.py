from pymongo import MongoClient, errors
import logging

from config import MONGO_DB_NAME, MONGO_URI, MONGO_USERS_COLLECTION

logger = logging.getLogger(__name__)

try:
    logger.info("Connecting to MongoDB...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Test the connection
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
except errors.InvalidURI as exc:
    logger.error("Invalid MONGO_URI: %s", MONGO_URI)
    raise RuntimeError(
        "Invalid MONGO_URI environment variable. It must start with 'mongodb://' or 'mongodb+srv://'."
    ) from exc
except errors.ServerSelectionTimeoutError as exc:
    logger.error("MongoDB server not reachable. Check your connection string and network.")
    raise RuntimeError(
        "Cannot reach MongoDB server. Check your connection string and network connectivity."
    ) from exc
except Exception as exc:
    logger.error("MongoDB connection error: %s", exc)
    raise RuntimeError(f"Failed to connect to MongoDB: {exc}") from exc

database = client[MONGO_DB_NAME]
users_collection = database[MONGO_USERS_COLLECTION]


def ensure_indexes() -> None:
    users_collection.create_index("email", unique=True)
    users_collection.create_index("google_sub", unique=True, sparse=True)