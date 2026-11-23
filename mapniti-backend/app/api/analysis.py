from fastapi import APIRouter, Body
from app.services import analysis_engine

router = APIRouter()


@router.get("/crops")
def crops():
    return {"crops": [{"id": k, "name": v["name"]} for k, v in analysis_engine.CROPS.items()]}


@router.post("/{tool_id}")
def run(tool_id: str, data: dict = Body(...)):
    """Runs one analysis tool (urban-*, disaster-*, agri-*, hydro-*) for the AOI in data.geometry."""
    return analysis_engine.run_tool(tool_id, data)
