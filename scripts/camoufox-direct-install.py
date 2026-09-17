#!/usr/bin/env python3
"""تثبيت Camoufox مباشرة من رابط الريليز (تجاوز GitHub API rate-limited sync)."""
import sys

from camoufox.multiversion import install_versioned
from camoufox.pkgman import AvailableVersion, CamoufoxFetcher, RepoConfig, Version

sel = AvailableVersion(
    version=Version(build="beta.30", version="152.0.4"),
    url="https://github.com/daijro/camoufox/releases/download/v152.0.4-beta.30/camoufox-152.0.4-beta.30-lin.x86_64.zip",
    is_prerelease=False,
)
fetcher = CamoufoxFetcher(repo_config=RepoConfig.get_default(), selected_version=sel)
ok = install_versioned(fetcher, replace=True)
sys.exit(0 if ok else 1)
