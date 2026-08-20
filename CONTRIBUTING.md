# Contributing to Facial Recognition Attendance

First off, thank you for considering contributing to **Facial Recognition Attendance**! It's people like you that make this tool great. 

This document provides guidelines and steps for contributing to the repository.

## 1. Code of Conduct
By participating in this project, you are expected to uphold a welcoming and inclusive environment. Please be respectful, constructive, and open to feedback.

## 2. Getting Started
- **Fork the repository** and clone it locally.
- Ensure you have the required dependencies installed for the component you wish to work on:
  - **Backend**: Python 3.11+, `uv` or `pip`
  - **Web**: Bun 1.3.x
  - **Mobile**: Flutter SDK
- Check the respective `README.md` files in the `backend/`, `web/`, and `mobile/` directories for setup instructions.

## 3. Branching Strategy
We follow a structured branching naming convention. Please create a new branch from `main` before starting your work:
- `feature/your-feature-name` (For new features)
- `bugfix/issue-description` (For bug fixes)
- `docs/what-you-changed` (For documentation updates)
- `chore/what-you-did` (For maintenance tasks)

## 4. Development Workflow

### Backend (FastAPI)
- Format code using `black` and `isort`.
- Ensure all tests pass by running `pytest`.
- Write unit tests for new API endpoints or critical logic.

### Web (React + Vite)
- Follow the existing TailwindCSS design tokens (`src/index.css`).
- Keep components small and reusable.
- Ensure Oxlint checks pass: `bun run lint`.
- Ensure Vitest tests pass: `bun run test`.

### Mobile (Flutter)
- Run `flutter analyze` to ensure code quality.
- Run `flutter test` before submitting changes.
- Avoid placing hardcoded strings; use the established constants.

## 5. Submitting a Pull Request (PR)
1. Commit your changes with clear, descriptive commit messages.
2. Push your branch to your forked repository.
3. Open a Pull Request against the `main` branch.
4. Provide a clear description of the problem you are solving and the solution you have implemented. If it's a UI change, please include screenshots!
5. A maintainer will review your PR. Be prepared to make requested changes.

## 6. Reporting Issues
If you find a bug or have a feature request, please create an Issue using the GitHub issue tracker. Include as much detail as possible:
- Steps to reproduce the bug.
- Expected vs actual behavior.
- Environment details (OS, Node version, Python version, etc.).

Thank you for your contributions!
