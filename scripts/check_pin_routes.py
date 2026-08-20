import sys
sys.path.insert(0, "backend")
from app.main import app

def walk(routes):
    for route in routes:
        if hasattr(route, "path"):
            yield route.path
        nested = getattr(route, "routes", None)
        if nested:
            yield from walk(nested)

print(sorted(path for path in set(walk(app.routes)) if "/attendance/pin" in path))
