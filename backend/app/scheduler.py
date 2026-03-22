import asyncio
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _run_async(coro):
    """Helper to run async coroutine from synchronous scheduler context."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(coro)
    finally:
        loop.close()


async def _check_retest_alerts():
    """
    Daily job: Find batches where retest_date is within 15 days and is APPROVED.
    Send in-app + email notifications to QC Head and QC Executive.
    """
    from sqlalchemy import select
    from app.models.inventory_models import Batch, BatchStatus
    from app.models.user_models import User, Role
    from app.notifications.service import notify_roles, create_notification
    from app.utils.email_sender import send_retest_alert_email

    today = datetime.utcnow().date()
    alert_threshold = today + timedelta(days=15)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Batch).where(
                Batch.status == BatchStatus.APPROVED,
                Batch.retest_date != None,
                Batch.retest_date <= alert_threshold,
                Batch.retest_date >= today,
            )
        )
        batches = result.scalars().all()

        if not batches:
            return

        for batch in batches:
            days_remaining = (batch.retest_date - today).days
            title = f"Retesting Due: {batch.batch_number}"
            message = f"Batch {batch.batch_number} requires retesting in {days_remaining} days (due: {batch.retest_date})."

            await notify_roles(
                db,
                [
                    "QC_HEAD",
                    "QC_EXECUTIVE",
                    "WAREHOUSE_HEAD",
                    "WAREHOUSE_USER",
                ],
                title,
                message,
                entity_type="batch",
                entity_id=batch.id,
            )

            # Email QC Head
            qc_heads = await db.execute(
                select(User).join(Role, User.role_id == Role.id).where(
                    Role.role_name == "QC_HEAD", User.is_active == True
                )
            )
            for qc_head in qc_heads.scalars().all():
                try:
                    await send_retest_alert_email(
                        qc_head.email, qc_head.name,
                        batch.batch_number, str(batch.retest_date), days_remaining
                    )
                except Exception as e:
                    logger.error(f"Retest alert email failed for {qc_head.email}: {e}")

        await db.commit()
        logger.info(f"Retest alerts sent for {len(batches)} batches")


async def _check_expiry_alerts():
    """
    Daily job: Find batches expiring within 30 days.
    Notify Warehouse Head, QC Head.
    """
    from sqlalchemy import select
    from app.models.inventory_models import Batch, BatchStatus
    from app.notifications.service import notify_roles

    today = datetime.utcnow().date()
    alert_threshold = today + timedelta(days=30)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Batch).where(
                Batch.expiry_date != None,
                Batch.expiry_date <= alert_threshold,
                Batch.expiry_date >= today,
                Batch.remaining_quantity > 0,
            )
        )
        batches = result.scalars().all()

        for batch in batches:
            days_remaining = (batch.expiry_date - today).days
            title = f"Expiry Alert: {batch.batch_number}"
            message = f"Batch {batch.batch_number} expires in {days_remaining} days (expiry: {batch.expiry_date}). Current stock: {batch.remaining_quantity}."

            await notify_roles(
                db,
                ["WAREHOUSE_HEAD", "WAREHOUSE_USER", "QC_HEAD", "QC_EXECUTIVE"],
                title,
                message,
                entity_type="batch",
                entity_id=batch.id,
            )

        if batches:
            await db.commit()
            logger.info(f"Expiry alerts sent for {len(batches)} batches")


def job_retest_alerts():
    _run_async(_check_retest_alerts())


def job_expiry_alerts():
    _run_async(_check_expiry_alerts())


def start_scheduler():
    scheduler.add_job(
        job_retest_alerts,
        trigger="cron",
        hour=7,
        minute=0,
        id="retest_alert_job",
        replace_existing=True,
    )
    scheduler.add_job(
        job_expiry_alerts,
        trigger="cron",
        hour=7,
        minute=30,
        id="expiry_alert_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started: retest_alert_job at 07:00, expiry_alert_job at 07:30")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
