"""
HEC-HMS-equivalent Hydrologic Engine
=====================================
Reproduces the standard lumped-basin rainfall-runoff methods used by
HEC-HMS: the SCS/NRCS Curve Number loss method, and the SCS synthetic
triangular Unit Hydrograph transform (Chow/Maidment/Mays, "Applied
Hydrology"; NRCS NEH Part 630).

Basin parameters (area, average slope, curve number) are derived from
real GEE datasets (ESA WorldCover land cover + OpenLandMap soil clay
content), the same way hydrology_engine.py derives terrain layers. The
hydrograph computation itself (loss -> excess -> convolution) is plain
deterministic math, mirroring how HEC-HMS evaluates a single sub-basin,
and needs no further GEE calls.
"""
import logging
import math
import numpy as np
import ee
from app.services.hydrology_engine import init_earth_engine, get_roi, get_dem_image

logger = logging.getLogger("mapniti.hms")


def _trapz(y, dx):
    """
    Trapezoidal-rule integral, implemented by hand rather than calling
    numpy's trapz/trapezoid: the function was renamed between numpy
    versions (trapz -> trapezoid, removed in 2.2+), so relying on either
    name is a version trap. This form works on any numpy 1.x/2.x install.
    """
    y = np.asarray(y, dtype=float)
    if y.size < 2:
        return 0.0
    return float(dx * (y.sum() - 0.5 * (y[0] + y[-1])))

# ------------------------------------------------------------------
# Curve Number lookup — NRCS TR-55 Table 2-2 style values (AMC-II),
# keyed by ESA WorldCover v200 class code, split by Hydrologic Soil Group.
# ------------------------------------------------------------------
WORLDCOVER_CN = {
    10:  {"A": 30, "B": 55, "C": 70, "D": 77},   # Tree cover
    20:  {"A": 35, "B": 56, "C": 70, "D": 77},   # Shrubland
    30:  {"A": 49, "B": 69, "C": 79, "D": 84},   # Grassland
    40:  {"A": 67, "B": 78, "C": 85, "D": 89},   # Cropland
    50:  {"A": 77, "B": 85, "C": 90, "D": 92},   # Built-up
    60:  {"A": 68, "B": 79, "C": 86, "D": 89},   # Bare / sparse vegetation
    70:  {"A": 98, "B": 98, "C": 98, "D": 98},   # Snow / ice
    80:  {"A": 100, "B": 100, "C": 100, "D": 100},  # Permanent water
    90:  {"A": 78, "B": 84, "C": 88, "D": 90},   # Herbaceous wetland
    95:  {"A": 78, "B": 84, "C": 88, "D": 90},   # Mangroves
    100: {"A": 49, "B": 69, "C": 79, "D": 84},   # Moss / lichen
}
_HSG_LETTERS = {1: "A", 2: "B", 3: "C", 4: "D"}


def _hsg_image(roi):
    """
    Hydrologic Soil Group, approximated from surface clay content.
    This is a simplified global proxy (clay% thresholds) used when a local
    soil-survey product (e.g. SSURGO) isn't available — standard practice
    for ungauged-basin CN estimation, but coarser than a true HSG map.
    """
    clay = ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0").clip(roi)
    hsg = ee.Image(4).where(clay.lt(40), 3).where(clay.lt(20), 2).where(clay.lt(10), 1)
    return hsg.rename("HSG")


def _cn_image(roi):
    worldcover = ee.Image("ESA/WorldCover/v200/2021").select("Map").clip(roi)
    hsg = _hsg_image(roi)
    combo = worldcover.multiply(10).add(hsg)  # e.g. tree cover(10) + HSG B(2) -> 102

    from_vals, to_vals = [], []
    for wc_class, cn_by_hsg in WORLDCOVER_CN.items():
        for hsg_num, letter in _HSG_LETTERS.items():
            from_vals.append(wc_class * 10 + hsg_num)
            to_vals.append(cn_by_hsg[letter])

    cn = combo.remap(from_vals, to_vals, 70)  # default CN 70 for any unmapped combo
    return cn.rename("CN")


def get_basin_parameters(data: dict) -> dict:
    """
    Step 1 of the HEC-HMS-equivalent workflow — derives the sub-basin
    parameters needed for the SCS-CN loss + SCS Unit Hydrograph transform:
    area, average curve number, average slope, an approximate basin
    "length" (bounding-box diagonal — a standard simplification when a
    full longest-flow-path trace isn't performed), and time of
    concentration via the Kirpich (1940) equation.
    """
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "No ROI (geometry) provided"}

    try:
        dem_source = data.get("dem_source", "SRTM")
        dem = get_dem_image(dem_source, roi)

        slope_deg = ee.Terrain.slope(dem)
        slope_frac = slope_deg.multiply(math.pi / 180).tan().rename("slope")

        cn_img = _cn_image(roi)

        stats = ee.Image.cat([slope_frac, cn_img]).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=roi,
            scale=90,
            maxPixels=1e10,
            bestEffort=True,
        )

        bounds = roi.bounds()
        ring = ee.List(bounds.coordinates().get(0))
        sw = ee.Geometry.Point(ring.get(0))
        ne = ee.Geometry.Point(ring.get(2))

        combined = ee.Dictionary(stats).combine(ee.Dictionary({"length_m": sw.distance(ne, 1)}))
        area_km2 = roi.area(1).divide(1_000_000)
        combined = combined.combine(ee.Dictionary({"area_km2": area_km2}))

        info = combined.getInfo()

        avg_slope = info.get("slope") or 0.001
        avg_slope = max(avg_slope, 0.0005)  # guard against a near-flat basin blowing up Tc
        avg_cn = info.get("CN") or 70
        length_m = info.get("length_m") or 100
        area_val = info.get("area_km2") or 0

        # Kirpich (1940), SI form: Tc(min) = 0.01947 * L(m)^0.77 * S(m/m)^-0.385
        tc_hr = (0.01947 * (length_m ** 0.77) * (avg_slope ** -0.385)) / 60

        return {
            "status": "success",
            "params": {
                "area_km2": round(area_val, 3),
                "avg_slope_percent": round(avg_slope * 100, 2),
                "curve_number": round(avg_cn, 1),
                "basin_length_km": round(length_m / 1000, 2),
                "time_of_concentration_hr": round(max(tc_hr, 0.1), 2),
            },
        }
    except Exception as exc:
        logger.exception("get_basin_parameters failed")
        return {"status": "error", "message": str(exc)}


# ------------------------------------------------------------------
# Design storm — deterministic, exactly-defined temporal patterns.
# (No NRCS "Type II" table is hard-coded here: that distribution comes
# from a tabulated government dataset, and reproducing it from memory
# risks small transcription errors. Uniform and Triangular are the two
# standard, exactly-defined patterns used instead; a Type II curve can
# be added later by loading the published NEH-630 table as data rather
# than hard-coding it.)
# ------------------------------------------------------------------
def _build_hyetograph(total_depth_mm, duration_hr, dt_hr, distribution, peak_fraction=0.5):
    n_steps = max(int(round(duration_hr / dt_hr)), 1)
    t = np.arange(1, n_steps + 1) * dt_hr

    if distribution == "triangular":
        peak_t = max(min(peak_fraction, 0.99), 0.01) * duration_hr
        rise = t / peak_t
        fall = (duration_hr - t) / (duration_hr - peak_t)
        shape = np.clip(np.where(t <= peak_t, rise, fall), 0, None)
        if shape.sum() == 0:
            shape = np.ones(n_steps)
        incremental = shape / shape.sum() * total_depth_mm
    else:  # "uniform"
        incremental = np.full(n_steps, total_depth_mm / n_steps)

    return t, incremental


def _scs_cn_excess(incremental_rain_mm, curve_number, ia_ratio=0.2):
    """SCS-CN incremental loss -> incremental rainfall-excess (mm), same timestep grid."""
    s_mm = (25400.0 / curve_number) - 254.0
    ia_mm = ia_ratio * s_mm

    cum_p = np.cumsum(incremental_rain_mm)
    cum_pe = np.where(
        cum_p > ia_mm,
        ((cum_p - ia_mm) ** 2) / (cum_p - ia_mm + s_mm),
        0.0,
    )
    incremental_pe = np.diff(cum_pe, prepend=0.0)
    incremental_pe = np.clip(incremental_pe, 0, None)
    return incremental_pe, s_mm, ia_mm


def _scs_triangular_uh(area_km2, tc_hr, dt_hr, n_ordinates):
    """
    SCS synthetic triangular Unit Hydrograph for 1 cm of excess rainfall
    uniformly distributed over dt_hr.
      Tp = D/2 + 0.6*Tc   (time to peak)
      Tb = 2.67*Tp        (time base)
      Qp = 2.08*A/Tp      (SI peak-rate factor, m3/s per cm over A km2)
    """
    tp_hr = dt_hr / 2 + 0.6 * tc_hr
    tb_hr = 2.67 * tp_hr
    qp = 2.08 * area_km2 / tp_hr  # m3/s per cm

    t = np.arange(1, n_ordinates + 1) * dt_hr
    uh = np.where(
        t <= tp_hr,
        qp * (t / tp_hr),
        np.where(t <= tb_hr, qp * ((tb_hr - t) / (tb_hr - tp_hr)), 0.0),
    )
    uh = np.clip(uh, 0, None)

    # Discretization correction: rescale so the UH volume matches exactly
    # 1 cm of runoff depth over the basin area (removes small trapezoidal
    # sampling error from evaluating the analytic triangle on a dt grid).
    target_volume_m3 = area_km2 * 1_000_000 * 0.01  # 1 cm over area, in m3
    actual_volume_m3 = _trapz(uh, dt_hr * 3600)
    if actual_volume_m3 > 0:
        uh = uh * (target_volume_m3 / actual_volume_m3)

    return t, uh, tp_hr, tb_hr, qp


def run_rainfall_runoff(data: dict) -> dict:
    """
    Step 2 of the HEC-HMS-equivalent workflow — given basin parameters
    (from get_basin_parameters, or user-overridden) plus a design storm,
    computes the rainfall-excess hyetograph (SCS-CN) and convolves it
    with an SCS synthetic triangular Unit Hydrograph to produce the
    direct-runoff hydrograph.
    """
    try:
        area_km2 = float(data["area_km2"])
        curve_number = float(data["curve_number"])
        tc_hr = float(data["time_of_concentration_hr"])
        total_rain_mm = float(data["rainfall_depth_mm"])
        duration_hr = float(data["storm_duration_hr"])
        distribution = data.get("distribution", "uniform")
        ia_ratio = float(data.get("ia_ratio", 0.2))

        if area_km2 <= 0 or curve_number <= 0 or curve_number > 100 or duration_hr <= 0 or total_rain_mm < 0:
            return {"status": "error", "message": "Invalid basin or storm parameters."}

        dt_hr = max(min(duration_hr / 50, tc_hr / 3 if tc_hr > 0 else duration_hr), 0.05)
        dt_hr = min(dt_hr, duration_hr)

        t_rain, incremental_rain = _build_hyetograph(total_rain_mm, duration_hr, dt_hr, distribution)
        incremental_pe, s_mm, ia_mm = _scs_cn_excess(incremental_rain, curve_number, ia_ratio)
        n_rain = len(incremental_pe)

        # Build the unit hydrograph long enough to cover its own time base Tb
        tp_est = dt_hr / 2 + 0.6 * tc_hr
        tb_est = 2.67 * tp_est
        n_uh = max(int(math.ceil(tb_est / dt_hr)) + 1, 2)
        _, uh, tp, tb, qp = _scs_triangular_uh(area_km2, tc_hr, dt_hr, n_uh)

        # Discrete convolution: direct runoff = sum of (excess_i/1cm) * UH shifted
        n_out = n_rain + n_uh - 1
        hydrograph = np.zeros(n_out)
        for i, pe_cm in enumerate(incremental_pe / 10.0):  # mm -> cm
            if pe_cm <= 0:
                continue
            hydrograph[i:i + n_uh] += pe_cm * uh

        t_out = np.arange(1, n_out + 1) * dt_hr
        peak_idx = int(np.argmax(hydrograph))
        peak_q = float(hydrograph[peak_idx])
        peak_t = float(t_out[peak_idx])

        runoff_volume_m3 = _trapz(hydrograph, dt_hr * 3600)
        runoff_depth_mm = (runoff_volume_m3 / (area_km2 * 1_000_000)) * 1000
        total_excess_mm = float(incremental_pe.sum())

        series = []
        for i in range(n_out):
            series.append({
                "t_hr": round(float(t_out[i]), 3),
                "rainfall_mm": round(float(incremental_rain[i]), 3) if i < n_rain else 0.0,
                "excess_mm": round(float(incremental_pe[i]), 3) if i < n_rain else 0.0,
                "discharge_cms": round(float(hydrograph[i]), 3),
            })

        return {
            "status": "success",
            "results": {
                "peak_discharge_cms": round(peak_q, 3),
                "time_to_peak_hr": round(peak_t, 2),
                "time_of_concentration_hr": round(tc_hr, 2),
                "runoff_volume_m3": round(runoff_volume_m3, 1),
                "runoff_depth_mm": round(runoff_depth_mm, 2),
                "total_rainfall_mm": round(total_rain_mm, 2),
                "total_excess_mm": round(total_excess_mm, 2),
                "potential_retention_s_mm": round(s_mm, 2),
                "initial_abstraction_mm": round(ia_mm, 2),
                "unit_hydrograph_tp_hr": round(tp, 2),
                "unit_hydrograph_tb_hr": round(tb, 2),
            },
            "series": series,
        }
    except (KeyError, ValueError) as exc:
        return {"status": "error", "message": f"Missing or invalid input: {exc}"}
    except Exception as exc:
        logger.exception("run_rainfall_runoff failed")
        return {"status": "error", "message": str(exc)}
