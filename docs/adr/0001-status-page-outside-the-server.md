# 1. Host the status page outside the server

Date: 2026-10-23 · Status: accepted

## Context

A status page is read when something is broken. If it runs on the VPS it watches, the outage that matters most takes the page down with it, and the visitor sees an error instead of an explanation. Grafana, which runs on the VPS, is reachable only through an SSH tunnel, so it cannot be the public page either.

## Decision

A dedicated repository, with nothing running on my server:

- **Probe**: a scheduled GitHub Actions workflow requests each site every 15 minutes from GitHub's network, with verified TLS, and retries once before calling a site down.
- **History**: one `checks.json` on a `data` branch, written through the Contents API. The commits are made by GitHub and so are signed, which keeps the `main` ruleset (signed commits) untouched. Thirty days are kept.
- **Page**: static files on GitHub Pages (source: Actions), custom domain `status.didelo.fr`, HTTPS enforced.
- **Alert**: the run fails after publishing when a site is down. GitHub emails the failure. No secret and no email relay is involved.

## Consequences

- The page stays up when the VPS is down. It depends only on GitHub, which is also where the code lives.
- GitHub's scheduler is not exact: a 15-minute cron can run late. The page tells the visitor when data is stale instead of showing green.
- The repository is public so Pages is free, so `targets.json` and the history are public. Only public URLs go in it.
- The `status` CNAME in the DNS zone must be created **after** the custom domain is set on the repository's Pages. A CNAME to `didelo-lilian.github.io` that no repository claims lets anyone claim `status.didelo.fr` (subdomain takeover).
- The email alert is a side effect of a failed run, so a down site that stays down sends one mail per run. Acceptable for one site; revisit with more.
