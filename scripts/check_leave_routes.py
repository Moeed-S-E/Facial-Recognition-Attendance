import sys
from fastapi.routing import APIRoute

sys.path.insert(0, "backend")
from app.main import app

paths = set()
def collect(routes):
    for route in routes:
        if isinstance(route, APIRoute):
            paths.add(route.path)
        elif hasattr(route, "routes"):
            collect(route.routes)
        elif hasattr(route, "original_router"):
            collect(route.original_router.routes)

collect(app.routes)
expected = {
    "/v1/organization/leave-requests",
    "/v1/organization/leave-requests/{request_id}/approve",
    "/v1/organization/leave-requests/{request_id}/reject",
}
missing = expected - paths
if missing:
    raise SystemExit(f"missing leave routes: {sorted(missing)}")
print(f"leave routes registered: {len(expected)}")
