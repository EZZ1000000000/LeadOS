#!/bin/bash
cd /home/z/my-project
node scripts/hardtest/p1-production-run.mjs
node scripts/hardtest/p3-handoff.mjs
echo "RUNNER A DONE"
