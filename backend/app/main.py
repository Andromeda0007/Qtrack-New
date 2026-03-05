import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create upload directories
    for directory in [settings.UPLOAD_DIR, settings.QR_DIR, settings.LABEL_DIR]:
        os.makedirs(directory, exist_ok=True)

    # Start scheduler
    from app.scheduler import start_scheduler, stop_scheduler
    start_scheduler()

    yield

    # Shutdown
    from app.scheduler import stop_scheduler
    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title="QTrack API",
    description="Warehouse & Quality Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for QR codes and labels
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register routers
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.materials.router import router as materials_router
from app.suppliers.router import router as suppliers_router
from app.inventory.router import router as inventory_router
from app.qc.router import router as qc_router
from app.qa.router import router as qa_router
from app.production.router import router as production_router
from app.finished_goods.router import router as fg_router
from app.notifications.router import router as notifications_router
from app.chat.router import router as chat_router
from app.audit.router import router as audit_router

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])
app.include_router(materials_router, prefix="/api/v1/materials", tags=["Materials"])
app.include_router(suppliers_router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(inventory_router, prefix="/api/v1/inventory", tags=["Inventory"])
app.include_router(qc_router, prefix="/api/v1/qc", tags=["Quality Control"])
app.include_router(qa_router, prefix="/api/v1/qa", tags=["Quality Assurance"])
app.include_router(production_router, prefix="/api/v1/production", tags=["Production"])
app.include_router(fg_router, prefix="/api/v1/finished-goods", tags=["Finished Goods"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(audit_router, prefix="/api/v1/audit", tags=["Audit"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )
