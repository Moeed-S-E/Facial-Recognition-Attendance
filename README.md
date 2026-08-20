<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Flutter-02569B?style=flat&logo=flutter&logoColor=white" alt="Flutter">
  <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" alt="React">
  
  <h1>🤖 Facial Recognition Attendance 🤖</h1>
  <p><strong>A secure, self-hosted, open-source attendance application powered by AI Facial Recognition.</strong></p>
</div>

<hr>

## ✨ Why This Project?

Facial Recognition Attendance provides a **seamless, local-first workflow** for organizations. Manage your teams, track attendance through advanced facial verification, and handle leave requests with ease.

Keep your organization's data strictly under **your control** without relying on third-party cloud data extraction.

---

## 🚀 Key Features

- **🔐 Role-Based Access Control**: Manage accounts with precision and strict security.
- **📸 Advanced Facial Verification**: Enroll and verify attendees instantly with FaceNet PyTorch & ChromaDB.
- **📊 Comprehensive Dashboard**: View attendance history, monitor check-ins/check-outs, and manage leave requests.
- **💾 Local Persistence**: SQLite out-of-the-box, with seamless PostgreSQL support for production.
- **⚡ Realtime WebSockets**: Instant live notifications for check-ins and managerial approvals.
- **🛡️ Privacy First**: Evidence is handled securely, with `local-only` retention defaults to respect user privacy.

---

## 🏗️ Technology Stack

| Component | Technology |
|---|---|
| **Backend** | Python, FastAPI, SQLAlchemy, SQLite/PostgreSQL, WebSockets |
| **Web Client** | React, Vite, Tailwind CSS |
| **Mobile Client** | Flutter, Dart |
| **Face Recognition** | FaceNet (PyTorch) and ChromaDB |

---

## 📁 Repository Layout

```text
backend/   FastAPI API, database models, face recognition, and tests
web/       React/Vite browser application
mobile/    Flutter mobile application
scripts/   Local helper scripts
```

---

## 💻 Run Locally

### 1️⃣ Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
> **Note:** The API is available at `http://localhost:8000`. The default database is local SQLite, so no external service is required for a basic start.

### 2️⃣ Web Client

```bash
cd web
pnpm install
pnpm dev
```
> **Note:** The web application runs at `http://localhost:5173` and uses `http://localhost:8000` as the default API base URL.

### 3️⃣ Mobile Client

```bash
cd mobile
flutter pub get
flutter run
```
> For more details on building and testing the mobile app, see the [Mobile README](./mobile/README.md) and [HOW_TO_GENERATE_APK.md](./HOW_TO_GENERATE_APK.md).

---

## 🧪 Demo Data & Seeding

To quickly create the sample organization and local demo accounts, run the seeder:

```bash
cd backend
python -m app.seed
```
This script creates sample organization, team, user, leave, and attendance records for local testing.

---

## ✅ Tests

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd web
pnpm test -- --run
pnpm build
```

---

## 📚 Documentation

- [Software Development Life Cycle (SDLC)](./SDLC.md)
- [How to Generate the Android APK](./HOW_TO_GENERATE_APK.md)

---

## 🤝 Contributing

Contributions are welcome! Please open an issue for substantial changes before submitting a pull request, keep changes focused, and include relevant tests.

## 📄 License

This project is released under the MIT License. See [LICENSE](./LICENSE).

## ⚠️ Privacy Note

Facial recognition can be inaccurate and may be regulated depending on location and use. Review applicable requirements, provide an appropriate non-biometric alternative, and **do not** use attendance or recognition results as the sole basis for consequential employment decisions.
