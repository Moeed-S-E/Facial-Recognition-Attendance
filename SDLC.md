# 🔄 Software Development Life Cycle (SDLC)

This document outlines the SDLC phases implemented and followed within the **Facial Recognition Attendance** project.

## 1. 📝 Requirements & Planning
- **Goal Definition**: Provide an open-source, local-first alternative for corporate attendance systems.
- **Core Requirements**: Support Web and Mobile clients, facial verification with AI, role-based access control, and strict privacy/retention policies.
- **Privacy Focus**: Emphasize `local-only` evidence retention to prevent biometrics misuse.

## 2. 🎨 Architecture & Design
- **API First**: A decoupled REST and WebSocket API built with `FastAPI` to act as the single source of truth.
- **Data Persistence**: `SQLite` for rapid development/testing, scaling to `PostgreSQL` in production. `ChromaDB` for handling the mathematical face embeddings.
- **Client Decoupling**: 
  - **Web**: `React` & `Vite` for administrative dashboard interactions.
  - **Mobile**: `Flutter` & `Dart` for employee-facing attendance capture at edge devices.

## 3. 💻 Implementation (Development)
- **Backend (Python)**: Implementation of SQLAlchemy models, PyTorch-driven `FaceNet` face recognition algorithms, robust JWT authentication, and WebSocket hubs for realtime feedback.
- **Web (React/TypeScript)**: Implementation of the organization dashboard utilizing TailwindCSS for rapid, responsive UI development.
- **Mobile (Flutter)**: Building native camera plugins, on-device image quality checks (framing/lighting), and securely communicating with the backend API.

## 4. 🧪 Testing & Validation
- **Backend Tests**: Automated test suites built with `pytest` for all major API routes, covering edge cases like unauthorized access or poor-quality face embeddings.
- **Frontend Checks**: Linting and testing with standard `vitest` pipelines to ensure dashboard reliability.
- **Mobile Analysis**: Regular runs of `flutter analyze` and widget testing to verify UI integrity.

## 5. 🚀 Deployment & CI/CD
- **Continuous Integration (CI)**: `GitHub Actions` validate backend tests, frontend builds, and mobile APK compilation automatically on every branch push and Pull Request.
- **Security Audits**: Implementation of `pip-audit` in the CI pipeline to proactively detect vulnerabilities in Python dependencies (like PyTorch/FastAPI).
- **Artifact Generation**: Detailed steps have been documented for generating distributable packages (see [HOW_TO_GENERATE_APK.md](./HOW_TO_GENERATE_APK.md)).

## 6. 🛠️ Maintenance & Monitoring
- Periodic updates to the machine learning models.
- Addressing community issues and feature requests.
- Keeping core dependencies (React, Flutter SDK, Python runtimes) up-to-date and secure.
