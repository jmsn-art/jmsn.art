# Gallery automation

Studio was retired from both active website branches. Its published files,
source, npm update configuration and dependency-audit workflows were removed.
Older revisions remain in Git history; local standalone Studio work is separate.

- **Gallery checks** (modern-site): required checks for tracked public HTML/CSS
  references and inline/external JavaScript syntax. Includes classic backup pages;
  excludes private development directories. External sites, runtime-generated
  URLs, JavaScript import resolution and visual rendering are not checked.
- **Repository checks** (main): checker regression tests and verification that
  the retired Studio directories remain absent. Classic presentation is preserved.
- **Dependabot**: weekly GitHub Actions update PRs for both branches. No npm
  manifests remain, and nothing auto-merges.
- **Published site verification**: after successful github-pages deployment-status
  events on modern-site, daily at 12:43 UTC, and manually. Compares public HTML,
  CSS, JavaScript, SVG and text metadata with the exact deployed commit, retrying
  for CDN propagation. Raster images/videos are excluded from byte comparison;
  their static HTML/CSS references are checked before merges.

Run `python3 _checks/gallery.py` with Node installed for gallery validation.
Run `python3 -m unittest discover -s _checks -p 'test_*.py'` for checker tests.
Keep Dependabot and published-check workflow configuration synchronized on both
branches: GitHub uses main for scheduling. Failures use existing GitHub Actions
notification preferences. Public-repository schedules may be disabled after
60 days of inactivity; periodically check Actions.

A deliberate classic rollback requires restoring main in the github-pages
allowlist before changing the Pages source. Both current branches omit Studio.
