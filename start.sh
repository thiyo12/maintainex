#!/bin/bash

# Maintainex Startup Script
export PATH="$HOME/Applications/node-v20.11.1-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")"
npm run dev
