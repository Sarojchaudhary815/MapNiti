from fastapi import APIRouter, Body
from app.services import engineering_service

router = APIRouter()


@router.post("/site-report")
def site_report(data: dict = Body(...)):
    return engineering_service.site_report(data)


@router.post("/point")
def point(data: dict = Body(...)):
    return engineering_service.point_inspect(data)


@router.post("/profile")
def profile(data: dict = Body(...)):
    return engineering_service.elevation_profile(data)
