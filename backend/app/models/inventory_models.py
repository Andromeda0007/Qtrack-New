from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Numeric, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class PackType(str, enum.Enum):
    BAG = "BAG"
    DRUM = "DRUM"
    BOX = "BOX"
    CARTON = "CARTON"
    CONTAINER = "CONTAINER"
    OTHER = "OTHER"


class BatchStatus(str, enum.Enum):
    QUARANTINE = "QUARANTINE"
    UNDER_TEST = "UNDER_TEST"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    QUARANTINE_RETEST = "QUARANTINE_RETEST"
    ISSUED_TO_PRODUCTION = "ISSUED_TO_PRODUCTION"


class MovementType(str, enum.Enum):
    GRN_RECEIVED = "GRN_RECEIVED"
    QC_SAMPLE = "QC_SAMPLE"
    ISSUE_TO_PRODUCTION = "ISSUE_TO_PRODUCTION"
    GRADE_TRANSFER = "GRADE_TRANSFER"
    FG_RECEIVED = "FG_RECEIVED"
    DISPATCH = "DISPATCH"
    ADJUSTMENT = "ADJUSTMENT"
    RETEST_QUARANTINE = "RETEST_QUARANTINE"
    REJECTION = "REJECTION"


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    material_name: Mapped[str] = mapped_column(String(150), nullable=False)
    material_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    unit_of_measure: Mapped[str] = mapped_column(String(20), default="kg")
    default_pack_size: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batches: Mapped[list["Batch"]] = relationship("Batch", back_populates="material")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    supplier_name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    batches: Mapped[list["Batch"]] = relationship("Batch", back_populates="supplier")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    location_name: Mapped[str] = mapped_column(String(100), nullable=False)
    location_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    material_id: Mapped[int] = mapped_column(Integer, ForeignKey("materials.id"), nullable=False)
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.id"), nullable=True)
    batch_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    manufacture_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date, index=True)
    pack_size: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    pack_type: Mapped[str] = mapped_column(SAEnum(PackType), default=PackType.BAG)
    total_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    remaining_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    status: Mapped[str] = mapped_column(SAEnum(BatchStatus), default=BatchStatus.QUARANTINE, index=True)
    location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id"), nullable=True)
    qr_code_path: Mapped[str | None] = mapped_column(String(500))
    retest_date: Mapped[date | None] = mapped_column(Date, index=True)
    retest_cycle: Mapped[int] = mapped_column(Integer, default=0)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    material: Mapped["Material"] = relationship("Material", back_populates="batches")
    supplier: Mapped["Supplier | None"] = relationship("Supplier", back_populates="batches")
    grn: Mapped["GRN | None"] = relationship("GRN", back_populates="batch", uselist=False)
    status_history: Mapped[list["BatchStatusHistory"]] = relationship("BatchStatusHistory", back_populates="batch")
    stock_movements: Mapped[list["StockMovement"]] = relationship("StockMovement", back_populates="batch")
    qc_results: Mapped[list["QCResult"]] = relationship("QCResult", back_populates="batch")
    retest_cycles: Mapped[list["RetestCycle"]] = relationship("RetestCycle", back_populates="batch")
    grade_transfers: Mapped[list["GradeTransfer"]] = relationship("GradeTransfer", back_populates="batch")


class GRN(Base):
    __tablename__ = "grn"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False)
    grn_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    received_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    received_date: Mapped[date] = mapped_column(Date, default=datetime.utcnow)
    invoice_number: Mapped[str | None] = mapped_column(String(100))
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="grn")


class BatchStatusHistory(Base):
    __tablename__ = "batch_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    old_status: Mapped[str | None] = mapped_column(SAEnum(BatchStatus))
    new_status: Mapped[str] = mapped_column(SAEnum(BatchStatus), nullable=False)
    changed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="status_history")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    movement_type: Mapped[str] = mapped_column(SAEnum(MovementType), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    from_location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id"), nullable=True)
    to_location_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id"), nullable=True)
    performed_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(100))
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="stock_movements")
