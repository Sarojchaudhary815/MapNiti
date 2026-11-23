// FastAPI/Pydantic returns `detail` as a string for a plain HTTPException, but
// as an array of {type, loc, msg, ...} objects for a 422 validation error —
// rendering that array directly as JSX crashes React. This always resolves
// to a plain string.
export const getErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        const msg = detail.map((d) => d?.msg).filter(Boolean).join(" ");
        return msg || fallback;
    }
    if (detail && typeof detail === "object" && detail.msg) return detail.msg;
    return fallback;
};
