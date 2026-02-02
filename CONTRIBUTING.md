# Contributing to CityCells

Thank you for your interest in contributing to CityCells! This document outlines the process for contributing to this project.

## Development Workflow

1.  **Fork and Clone**: Fork the repository and clone it locally.
2.  **Branching**: Create a new branch for your feature or fix.
    *   Example: `feat/add-strava-auth` or `fix/map-rendering`
3.  **Install Dependencies**: Run `npm install`.
4.  **Develop**: Make your changes.
5.  **Lint**: Ensure your code passes linting by running `npm run lint`.
6.  **Commit**: Commit your changes using Conventional Commits (see below).
7.  **Push**: Push your branch and open a Pull Request.

## Commit Messages

We enforce **Conventional Commits** to maintain a clean history and enable automated tooling.

### Format
```
<type>(<scope>): <subject>
```

### Types
*   **feat**: A new feature
*   **fix**: A bug fix
*   **docs**: Documentation only changes
*   **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
*   **refactor**: A code change that neither fixes a bug nor adds a feature
*   **perf**: A code change that improves performance
*   **test**: Adding missing tests or correcting existing tests
*   **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
*   **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
*   **chore**: Other changes that don't modify src or test files
*   **revert**: Reverts a previous commit

### Examples
*   `feat(auth): implement strava oauth flow`
*   `fix(map): resolve memory leak in leaflet component`
*   `docs: update readme with setup instructions`
*   `chore: update dependencies`

### Enforcement
This repository uses `husky` and `commitlint`. Your commit will be rejected if it does not follow this convention.
