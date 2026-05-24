from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from config import GOOGLE_CLIENT_ID, JWT_ALGORITHM, JWT_EXPIRES_MINUTES, JWT_SECRET_KEY
from db import users_collection


router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    id_token: str


class UserOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    auth_providers: list[str]
    google_sub: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _public_user(user_doc: dict) -> UserOut:
    return UserOut(
        id=str(user_doc["_id"]),
        first_name=user_doc.get("first_name", ""),
        last_name=user_doc.get("last_name", ""),
        email=user_doc.get("email", ""),
        auth_providers=user_doc.get("auth_providers", ["password"]),
        google_sub=user_doc.get("google_sub"),
    )


def _create_access_token(user_doc: dict) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MINUTES)
    payload = {
        "sub": str(user_doc["_id"]),
        "email": user_doc.get("email"),
        "exp": expires,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _auth_response(user_doc: dict) -> AuthResponse:
    return AuthResponse(access_token=_create_access_token(user_doc), user=_public_user(user_doc))


def _get_user_by_email(email: str) -> dict | None:
    return users_collection.find_one({"email": _normalize_email(email)})


def _get_user_by_id(user_id: str) -> dict | None:
    from bson import ObjectId

    try:
        return users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def _verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _require_google_client_id() -> str:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured")
    return GOOGLE_CLIENT_ID


def _upsert_google_user(payload: dict) -> dict:
    email = _normalize_email(payload.get("email", ""))
    if not email:
        raise HTTPException(status_code=400, detail="Google account did not return an email address")

    first_name = payload.get("given_name") or payload.get("name", "").split(" ")[0] or ""
    last_name = payload.get("family_name") or ""
    google_sub = payload.get("sub")
    now = datetime.now(timezone.utc)

    existing = users_collection.find_one({"email": email})
    if existing:
        update = {
            "$set": {
                "google_sub": google_sub,
                "auth_providers": sorted(set(existing.get("auth_providers", ["password"]) + ["google"])),
                "updated_at": now,
                "last_login_at": now,
            }
        }
        if not existing.get("first_name") and first_name:
            update["$set"]["first_name"] = first_name
        if not existing.get("last_name") and last_name:
            update["$set"]["last_name"] = last_name
        users_collection.update_one({"_id": existing["_id"]}, update)
        return users_collection.find_one({"_id": existing["_id"]})

    document = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password_hash": None,
        "google_sub": google_sub,
        "auth_providers": ["google"],
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
    }
    result = users_collection.insert_one(document)
    return users_collection.find_one({"_id": result.inserted_id})


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest):
    email = _normalize_email(body.email)
    if not body.first_name.strip() or not body.last_name.strip():
        raise HTTPException(status_code=400, detail="first_name and last_name are required")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if not body.password:
        raise HTTPException(status_code=400, detail="password is required")

    now = datetime.now(timezone.utc)
    existing = _get_user_by_email(email)
    if existing and existing.get("password_hash"):
        raise HTTPException(status_code=400, detail="Email is already registered")

    if existing:
        users_collection.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "first_name": body.first_name.strip(),
                    "last_name": body.last_name.strip(),
                    "password_hash": _hash_password(body.password),
                    "auth_providers": sorted(set(existing.get("auth_providers", []) + ["password"])),
                    "updated_at": now,
                    "last_login_at": now,
                }
            },
        )
        user_doc = users_collection.find_one({"_id": existing["_id"]})
        return _auth_response(user_doc)

    document = {
        "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(),
        "email": email,
        "password_hash": _hash_password(body.password),
        "auth_providers": ["password"],
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
    }
    result = users_collection.insert_one(document)
    user_doc = users_collection.find_one({"_id": result.inserted_id})
    return _auth_response(user_doc)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    email = _normalize_email(body.email)
    user_doc = _get_user_by_email(email)
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify_password(body.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    users_collection.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"last_login_at": datetime.now(timezone.utc)}},
    )
    user_doc = users_collection.find_one({"_id": user_doc["_id"]})
    return _auth_response(user_doc)


@router.post("/google", response_model=AuthResponse)
def login_with_google(body: GoogleLoginRequest):
    client_id = _require_google_client_id()
    try:
        payload = id_token.verify_oauth2_token(
            body.id_token,
            google_requests.Request(),
            client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google token") from exc

    user_doc = _upsert_google_user(payload)
    return _auth_response(user_doc)


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_doc = _get_user_by_id(user_id)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user_doc


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)


@router.post("/logout")
def logout():
    """Logout endpoint (client removes token from localStorage)."""
    return {"message": "Logged out successfully"}