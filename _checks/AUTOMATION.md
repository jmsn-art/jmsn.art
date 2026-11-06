# Security and gallery automation

`modern-site` is the published branch. `main` preserves the classic presentation
and also holds the automation configuration required by GitHub's default-branch
rules. Do not merge the modern design into main.

- **Studio checks**: existing required audit, tests, builds and generated-asset
  comparison on pull requests. Dependency PRs that change the build must include
  rebuilt `studio/` assets before merging; no automation bypasses this check.
- **Gallery checks**: local HTML and CSS references and inline/external JavaScript
  syntax on modern-site pull requests and pushes. Comments, non-JavaScript data
  blocks, and external URLs are ignored. It checks tracked public files, including
  classic backup pages and Studio, not private development directories. It does
  not crawl external stores, validate runtime-generated URLs, test rendering, or
  resolve JavaScript imports. Run `python3 _checks/gallery.py` with Node installed.
- **Scheduled dependency security**: daily at 12:23 UTC; independently audits
  main and modern-site lockfiles and fails for high/critical vulnerabilities.
  Also supports manual dispatch. It does not install dependencies or execute
  package lifecycle scripts.
- **Dependabot**: advisory-driven security PRs for default main; daily npm version
  PRs targeted explicitly at modern-site, plus weekly pinned-action updates for
  both branches. GitHub does not support advisory-driven security PRs targeting
  a non-default branch. Nothing auto-merges. Review majors separately; rebuild
  published Studio assets when needed. Security PRs for main do not automatically
  fix modern-site, so review the daily live-branch audit and update PRs as well.
- **Published site verification**: after successful Pages workflow completion,
  daily at 12:43 UTC, and on manual dispatch. Resolves the latest built Pages
  commit and compares public HTML, CSS, JS, SVG and text metadata against that
  exact commit, including classic backups and Studio. Retries five times over
  approximately two minutes for CDN propagation. Large raster images and videos
  are excluded; local references to those files are still checked before merge.
  A superseded deployment event is skipped in favor of the newer deployment.

Keep `.github/dependabot.yml`, `scheduled-security.yml`, and
`published-check.yml` in sync on both branches. GitHub uses their main copies for
scheduling/configuration. Scheduled jobs can be delayed; GitHub may disable
scheduled workflows after 60 days of inactivity in a public repository. Check
Actions periodically and re-enable if necessary. Failures appear in Actions and
use the account's existing GitHub notification preferences.

Validation: `python3 -m unittest discover -s _checks -p 'test_*.py'`.

Rollback to classic requires restoring main in the github-pages environment
allowlist before changing the Pages source. Published verification expects the
checker scripts on the deployed branch; add those scripts to main or suspend
that workflow as part of a deliberate classic rollback.
