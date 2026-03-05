from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Numeric, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class TestStatus(str, enum.Enum):
    UNDER_TEST = "UNDER_TEST"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class RetestStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class GradeTransferStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class QCResult(Base):
    __tablename__ = "qc_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    ar_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    sample_quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    test_status: Mapped[str] = mapped_column(SAEnum(TestStatus), default=TestStatus.UNDER_TEST)
    test_remarks: Mapped[str | None] = mapped_column(Text)
    retest_date: Mapped[date | None] = mapped_column(Date)
    sample_taken_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    approved_rejected_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    approved_rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="qc_results")


class RetestCycle(Base):
    __tablename__ = "retest_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    cycle_number: Mapped[int] = mapped_column(Integer, nullable=False)
    retest_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(SAEnum(RetestStatus), default=RetestStatus.PENDING)
    initiated_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    completed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="retest_cycles")


class GradeTransfer(Base):
    __tablename__ = "grade_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    old_material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    new_material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    old_material_id: Mapped[int] = mapped_column(Integer, ForeignKey("materials.id"), nullable=False)
    new_material_id: Mapped[int] = mapped_column(Integer, ForeignKey("materials.id"), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(SAEnum(GradeTransferStatus), default=GradeTransferStatus.PENDING)
    requested_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="grade_transfers")
