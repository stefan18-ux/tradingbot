import os
from cryptography.fernet import Fernet


def get_cipher() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("ENCRYPTION_KEY environment variable is not set")
    
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt_secret(plain: str) -> str:
    if plain is None:
        return None
    cipher = get_cipher()
    token = cipher.encrypt(plain.encode())
    return token.decode()


def decrypt_secret(token: str) -> str:
    if token is None:
        return None
    cipher = get_cipher()
    return cipher.decrypt(token.encode()).decode()
