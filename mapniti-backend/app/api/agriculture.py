from fastapi import APIRouter

router = APIRouter()

@router.get("/status")
def status():
    return {"module": "agriculture", "status": "active"}