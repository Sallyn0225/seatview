# Security Policy

## Supported Versions

Security fixes are handled on the `main` branch. This project does not maintain separate release branches yet.

## Reporting a Vulnerability

Please do not open a public issue for exploitable security details, secrets, or private user data.

Use GitHub's private vulnerability reporting flow:

<https://github.com/Sallyn0225/seatview/security/advisories/new>

If that page is unavailable, open a minimal public issue that says you need to report a vulnerability, without including technical details or proof-of-concept steps.

## Scope

Useful reports include:

- authentication or authorization bypasses
- upload validation bypasses
- stored or reflected cross-site scripting
- data exposure involving uploaded photos, metadata, or maintainer-only admin routes
- leaked secrets or deploy credentials
- dependency vulnerabilities that affect the deployed application

Out of scope:

- generic scanner output without an exploitable path
- missing security headers that do not create a practical vulnerability
- denial-of-service reports requiring unrealistic traffic volume
- social engineering or physical attacks

## Response

I aim to acknowledge valid private reports within 7 days. Fix timelines depend on severity and reproducibility.
