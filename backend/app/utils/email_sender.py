from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import settings


def get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def send_email(recipients: list[str], subject: str, body: str) -> bool:
    try:
        conf = get_mail_config()
        message = MessageSchema(
            subject=subject,
            recipients=recipients,
            body=body,
            subtype=MessageType.html,
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False


async def send_account_created_email(email: str, name: str, username: str, temp_password: str) -> bool:
    subject = "Your QTrack Account Has Been Created"
    body = f"""
    <html><body>
    <h2>Welcome to QTrack, {name}!</h2>
    <p>Your account has been created successfully.</p>
    <table>
        <tr><td><strong>Username:</strong></td><td>{username}</td></tr>
        <tr><td><strong>Temporary Password:</strong></td><td>{temp_password}</td></tr>
    </table>
    <p><strong>Please log in and change your password immediately.</strong></p>
    <p>For security, your temporary password will expire after first use.</p>
    </body></html>
    """
    return await send_email([email], subject, body)


async def send_password_reset_email(email: str, name: str, reset_token: str) -> bool:
    subject = "QTrack Password Reset Request"
    body = f"""
    <html><body>
    <h2>Password Reset Request</h2>
    <p>Hello {name},</p>
    <p>We received a request to reset your password.</p>
    <p>Use the token below to reset your password. This token expires in 15 minutes.</p>
    <p><strong>Reset Token:</strong> {reset_token}</p>
    <p>If you did not request a password reset, please ignore this email.</p>
    </body></html>
    """
    return await send_email([email], subject, body)


async def send_retest_alert_email(email: str, name: str, batch_number: str, retest_date: str, days_remaining: int) -> bool:
    subject = f"QTrack Retesting Alert — Batch {batch_number}"
    body = f"""
    <html><body>
    <h2>Retesting Required Soon</h2>
    <p>Hello {name},</p>
    <p>The following batch requires retesting in <strong>{days_remaining} days</strong>:</p>
    <table>
        <tr><td><strong>Batch Number:</strong></td><td>{batch_number}</td></tr>
        <tr><td><strong>Retesting Date:</strong></td><td>{retest_date}</td></tr>
    </table>
    <p>Please ensure the material is moved to the quarantine area for retesting when due.</p>
    </body></html>
    """
    return await send_email([email], subject, body)
