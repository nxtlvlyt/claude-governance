git-anchor.ps1 (the stop hook that creates cryptographic audit trails for all project directories)
now reads credentials — github_user, codeberg_user, and a Codeberg API token — from
~/.claude/p6-config.json, a plaintext JSON file that is gitignored.

The token is used to: (1) create new private Codeberg repos via REST API when a new
project directory is first anchored, and (2) will be read by install.ps1 to patch
git-anchor.ps1 during P6 setup on fresh machines.

Evaluate: Is plaintext gitignored JSON the right credential storage mechanism here?

Specific questions:
1. Security: Who can read ~/.claude/p6-config.json on a Windows machine? What is the
   actual blast radius if the file is exfiltrated or leaked (e.g. accidental commit,
   screenshot, sync tool)? The Codeberg token has write access to all user repos.
2. Portability: When a user clones the repo to a new machine, they need to re-create
   p6-config.json. Is that a usability problem or an acceptable setup step?
3. Alternatives: Windows Credential Manager (DPAPI-protected, cmdkey/Get-StoredCredential),
   environment variables ($env:CODEBERG_TOKEN), PowerShell SecureString exported to file,
   or prompting at session end only when needed. Which is better and why?
4. Scope: The token is only used at session END (stop hook). Is there value in a
   narrower-scoped token (create-repo-only) or is full user token acceptable given
   the use case?
5. install.ps1 currently writes the token to p6-config.json in plaintext. If the
   alternative is better, what should install.ps1 do instead?

The current implementation is live in hooks/git-anchor.ps1 and install.ps1.
If the chain recommends a change, be specific about what the replacement code should do.

## Substrate Files
hooks/git-anchor.ps1
install.ps1

## Search Queries
- Windows credential storage security plaintext JSON token file best practices 2026
- Windows Credential Manager DPAPI PowerShell Get-StoredCredential SecureString API token
- Codeberg Gitea API token scope fine-grained permissions security
- AI governance agent credential handling secrets management secure storage
- git-anchor session end hook credential token secure storage alternatives
