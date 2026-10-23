# `make check` runs the same checks as CI, `make serve` previews the page with the history from the last run.
DOCKER = docker run --rm -v "$(CURDIR):/repo" -w /repo

.PHONY: check serve

check:
	python3 -m unittest discover -s tests -v
	node --check site/app.js
	$(DOCKER) rhysd/actionlint:1.7.12
	gitleaks git --redact --no-banner

# Fetches the real history, then serves site/ with it on http://localhost:8000
serve:
	gh api "repos/Didelo-lilian/status/contents/checks.json?ref=data" -q .content | base64 -d > site/checks.json
	python3 -m http.server -d site 8000
