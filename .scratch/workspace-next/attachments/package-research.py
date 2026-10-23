"""Snapshot primary registry and repository evidence for this research ticket."""
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

packages = {
    "mammoth": "mwilliamson/mammoth.js",
    "file-type": "sindresorhus/file-type",
    "pdfjs-dist": "mozilla/pdf.js",
    "sharp": "lovell/sharp",
    "yauzl": "thejoshwolfe/yauzl",
    "pdf-lib": "Hopding/pdf-lib",
    "word-extractor": "morungos/node-word-extractor",
}

def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "attachment-feasibility"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

rows = []
for package, repo in packages.items():
    registry_url = "https://registry.npmjs.org/" + package
    registry = get(registry_url)
    version = registry["dist-tags"]["latest"]
    metadata = registry["versions"][version]
    download_url = "https://api.npmjs.org/downloads/point/last-week/" + package
    downloads = get(download_url)
    repository_url = "https://api.github.com/repos/" + repo
    repository = get(repository_url)
    activity = get(repository_url + "/issues?state=open&sort=updated&per_page=3")
    rows.append({
        "package": package, "version": version,
        "released": registry["time"][version],
        "types": metadata.get("types") or metadata.get("typings") or metadata.get("exports"),
        "downloads": downloads, "pushedAt": repository["pushed_at"],
        "openIssuesAndPRs": repository["open_issues_count"],
        "recentOpenActivity": [{"number": i["number"], "updatedAt": i["updated_at"], "pullRequest": "pull_request" in i} for i in activity],
        "sources": [registry_url, download_url, repository_url],
    })
    print(package, version, downloads["downloads"], "downloads last week")
output = Path(__file__).resolve().parent / "results" / "packages.json"
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps({"checkedAt": datetime.now(timezone.utc).isoformat(), "packages": rows}, indent=2), encoding="utf-8")
