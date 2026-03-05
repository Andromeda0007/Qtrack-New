from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Numeric, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class FGStatus(str, enum.Enum):
    CREATED = "CREATED"
    QA_PENDING = "QA_PENDING"
    QA_APPROVED = "QA_APPROVED"
    QA_REJECTED = "QA_REJECTED"
    WAREHOUSE_RECEIVED = "WAREHOUSE_RECEIVED"
    DISPATCHED = "DISPATCHED"


class QAInspectionStatus(str, enum.Enum):
    PENDING = "PENDING"
    PASSED = "PASSED"
    FAILED = "FAILED"


class FinishedGoodsBatch(Base):
    __tablename__ = "finished_goods_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    manufacture_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    net_weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    gross_weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    carton_count: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(SAEnum(FGStatus), default=FGStatus.CREATED, index=True)
    qr_code_path: Mapped[str | None] = mapped_column(String(500))
    shipper_label_path: Mapped[str | None] = mapped_column(String(500))
    remarks: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    qa_inspection: Mapped["QAInspection | None"] = relationship("QAInspection", back_populates="fg_batch", uselist=False)
    inventory: Mapped["FGInventory | None"] = relationship("FGInventory", back_populates="fg_batch", uselist=False)
    dispatches: Mapped[list["DispatchRecord"]] = relationship("DispatchRecord", back_populates="fg_batch")


class QAInspection(Base):
    __tablename__ = "qa_inspections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fg_batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("finished_goods_batches.id"), nullable=False)
    quantity_verified: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    status: Mapped[str] = mapped_column(SAEnum(QAInspectionStatus), default=QAInspectionStatus.PENDING)
    inspection_remarks: Mapped[str | None] = mapped_column(Text)
    inspected_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    approved_rejected_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    fg_batch: Mapped["FinishedGoodsBatch"] = relationship("FinishedGoodsBatch", back_populates="qa_inspection")


class FGInventory(Base):
    __tablename__ = "fg_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fg_batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("finished_goods_batches.id"), nullable=False)
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    received_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    fg_batch: Mapped["FinishedGoodsBatch"] = relationship("FinishedGoodsBatch", back_populates="inventory")


class DispatchRecord(Base):
    __tablename__ = "dispatch_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fg_batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("finished_goods_batches.id"), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    dispatch_date: Mapped[date] = mapped_column(Date, default=datetime.utcnow)
    invoice_number: Mapped[str | None] = mapped_column(String(100))
    remarks: Mapped[str | None] = mapped_column(Text)
    dispatched_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    fg_batch: Mapped["FinishedGoodsBatch"] = relationship("FinishedGoodsBatch", back_populates="dispatches")
