#!/bin/bash
cd /home/z/my-project
node scripts/hardtest/p2a-farm-ingest.mjs
node scripts/hardtest/p2b-groups.mjs
node scripts/hardtest/p2c-adslib.mjs
node scripts/hardtest/p2d-radar.mjs
node scripts/hardtest/p7-zizo.mjs
echo "RUNNER C DONE"
