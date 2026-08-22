# Security policy

## Supported versions

Until the first stable release, security fixes are made on the latest published `0.x` version only.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature on the repository's **Security** tab. Include reproduction steps, affected versions, impact, and any suggested remediation.

Clawdeck deliberately runs without API keys or a network service. Its sensitive surfaces are local lifecycle hooks, configuration-file merging, the shared state file, and the Stream Deck plugin process. Reports involving command injection, unsafe path handling, configuration loss, or unintended prompt/transcript persistence are especially valuable.
