# Security Policy
At SecureCycle, Privacy and Security is our #1 priority. We treat all privacy and security issues seriously. If you believe you have found a security issue, please report it to us via the security tab. This is a Vulnerability Disclosure Programs (VDP) so any reports will not be rewarded with any financial compensation. However, the researcher who reported the issue first, will be credited on our Github page 
Scope

## In scope

The SecureCycle mobile app (frontend/), in its most recent released version
The app’s lock, PIN, duress, wipe and erase features
Data storage, backup, export and sharing behaviour of the app
Privacy claims made in the README and this policy

## Out of scope

Older versions of SecureCycle. Reports against outdated versions will not be accepted.

The backend (backend/). It is a development stub that holds no data.

Issues that require root, jailbreak, instrumentation (such as Frida), or a compromised operating system

Behaviour the README describes as an accepted risk, including the optional PIN, weak PINs, the lack of screenshot protection, and the presence of db-debug in builds

Denial of service through normal use, and missing best-practice headers or configuration with no demonstrated security impact

Social engineering of the maintainer or users

## Supported versions

Only the most recent release of SecureCycle is supported. Reports must reproduce on that version.

## Reporting a vulnerability
Put the issue in the title. Name the affected behaviour clearly, for example “Auto-erase skipped when two erase checks overlap.”

Give step-by-step reproduction instructions. Include the device, operating system version, and the app build you tested.

Attach a proof of concept (PoC). A short video, script or log output makes triage faster.

Expect a decision. You will be notified whether your report is accepted or not.

All reports and the triage process are handled by [Aaron]([https://github.com/S-cpu3])
