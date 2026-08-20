export async function readJsonResponse(response, fallbackMessage = "The server returned an unexpected response.") {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    const looksLikeHtml = /^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(body);
    throw new Error(
      looksLikeHtml
        ? "The API URL returned the web application HTML instead of JSON. Check VITE_API_BASE_URL in web/.env.local."
        : fallbackMessage,
    );
  }

  try {
    return body ? JSON.parse(body) : null;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export async function requestJson(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await readJsonResponse(response, fallbackMessage);
      const rawDetail = payload?.detail || payload?.message || "";
      detail = Array.isArray(rawDetail) ? rawDetail.map((item) => `${item.loc?.join(".") || "field"}: ${item.msg || "Invalid value"}`).join("; ") : rawDetail;
    } catch (error) {
      detail = error.message;
    }
    throw new Error(detail || fallbackMessage);
  }
  return readJsonResponse(response, fallbackMessage);
}
