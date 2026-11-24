"""Credits for exports. Running tools and analyses is free; downloading or
exporting a result costs credits. Credits are bought with a payment that an
admin approves (QR / wallet transfer), or by a gateway later."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index

from app.database import Base


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    balance = Column(Integer, nullable=False, default=0)
    unlimited_until = Column(DateTime)            # monthly plan: exports are free until then
    created_at = Column(DateTime, default=datetime.utcnow)


class CreditEntry(Base):
    """Every change to a balance, for the user's history and for audits."""
    __tablename__ = "credit_entries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)        # + bought / granted, - spent
    reason = Column(String(40), nullable=False)    # welcome | purchase | grant | export | refund | plan
    note = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ExportCharge(Base):
    """One paid export. The same item can be downloaded again for 24 h at no cost."""
    __tablename__ = "export_charges"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ref = Column(String(120), nullable=False)
    kind = Column(String(30), nullable=False)
    label = Column(String(200))
    credits = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (Index("ix_export_charge_user_ref", "user_id", "ref"),)


class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pack_id = Column(String(30), nullable=False)
    amount_npr = Column(Integer, nullable=False)
    credits = Column(Integer, nullable=False, default=0)
    unlimited_days = Column(Integer, nullable=False, default=0)
    method = Column(String(30), nullable=False)    # esewa | khalti | fonepay | bank
    txn_id = Column(String(80), nullable=False, index=True)
    note = Column(String(500))
    proof_path = Column(String(255))               # screenshot, stored outside the public static folder
    status = Column(String(20), nullable=False, default="pending", index=True)   # pending | approved | rejected
    admin_note = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    decided_at = Column(DateTime)


class BillingSetting(Base):
    """Payment details shown to buyers (wallet number, account name, QR image)."""
    __tablename__ = "billing_settings"

    key = Column(String(60), primary_key=True)
    value = Column(Text)
