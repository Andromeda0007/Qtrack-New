from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class NotificationType(str, enum.Enum):
    QC_ALERT = "QC_ALERT"
    RETEST_ALERT = "RETEST_ALERT"
    EXPIRY_ALERT = "EXPIRY_ALERT"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    INVENTORY_ALERT = "INVENTORY_ALERT"
    APPROVAL_ALERT = "APPROVAL_ALERT"
    REJECTION_ALERT = "REJECTION_ALERT"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(SAEnum(NotificationType), default=NotificationType.SYSTEM_ALERT)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")
