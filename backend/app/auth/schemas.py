from pydantic import BaseModel, EmailStr


class UserLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str
    is_first_login: bool


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    def validate_password(self) -> bool:
        p = self.new_password
        return (
            len(p) >= 8
            and any(c.isupper() for c in p)
            and any(c.islower() for c in p)
            and any(c.isdigit() for c in p)
            and any(c in "!@#$%^&*" for c in p)
        )


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class MFASetupResponse(BaseModel):
    secret: str
    qr_uri: str


class MFAVerifyRequest(BaseModel):
    otp_code: str
