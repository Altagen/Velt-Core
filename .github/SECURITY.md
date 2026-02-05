# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in velt-core, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Send an email to [security contact] with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Measures

This project implements the following security measures:

### CI/CD Security
- **npm audit**: Automated dependency vulnerability scanning
- **CodeQL**: Static analysis for security vulnerabilities
- **Dependency Review**: Automated review of dependency changes in PRs
- **Dependabot**: Automated security updates for dependencies

### Supply Chain Security
- **SBOM**: Software Bill of Materials generated for each release (CycloneDX format)
- **Checksums**: SHA256 and SHA512 checksums for all release artifacts
- **npm Provenance**: Packages published with provenance attestation

### Code Quality
- **Conventional Commits**: Enforced commit message format
- **TypeScript**: Strict type checking enabled

## Verifying Releases

### Verify Package Checksum

```bash
# Download the package
npm pack velt-core@<version>

# Verify SHA256
sha256sum velt-core-<version>.tgz

# Compare with checksums in the GitHub release
```

### Verify npm Provenance

```bash
npm audit signatures
```

## Dependencies

We only use well-maintained dependencies from trusted sources:
- CodeMirror (BSD-licensed, widely used editor framework)
- TypeScript (Microsoft, Apache-2.0)

All dependencies are regularly updated via Dependabot.
