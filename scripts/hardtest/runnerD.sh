#!/bin/bash
cd /home/z/my-project
node scripts/hardtest/p5-failures.mjs
node scripts/hardtest/p6-agent.mjs
echo "RUNNER D DONE"
