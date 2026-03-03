# Security Policy

## Supported Versions

Currently, resonance is in deep-development and is not yet preparing for a public mainnet launch. 
Fixes are primarily maintained on the `main` branch. 

| Version | Supported          |
| ------- | ------------------ |
| v0.1.x  | :white_check_mark: |
| < v0.1  | :x:                |

## Reporting a Vulnerability

As a P2P protocol that handles cryptographic identities and establishes WebRTC peer connections, 
security is treated with the highest priority. If you believe you have found a security 
vulnerability in resonance, please report it to us immediately. 

Please **do not** file a public issue for security vulnerabilities. Instead, please report them 
privately. 

### What to Report
You should report vulnerabilities related to:
- **P2P Transport (WebRTC):** IP leakage without consent, forced disconnections (DDoS mechanics 
targeting peers), unauthorized relay manipulation.
- **Coordination Server:** Malicious socket payload injection, unauthorized graph modification, 
server memory exhaustion vectors.
- **Cryptoeconomics / Smart Contracts:** Identity spoofing, unauthorized generation of Flow Energy, 
bypassing signature verification.
- **Frontend / Next.js:** Cross-site scripting (XSS) within the canvas context or metadata renderer.

### How to Report
Please email the maintainers at `lhommeduchili@gmail.com` with the details of your findings. 
Include:
1. A descriptive title.
2. A description of the vulnerability and its potential impact.
3. Steps to reproduce the issue.
4. Any potential mitigations or solutions you can suggest.

We will acknowledge receipt of your vulnerability report as soon as possible, and we strive to send 
you regular updates about our progress. If the vulnerability is accepted, we will coordinate a fix 
and an advisory. 
