#!/bin/sh
cd "$(dirname "$0")" && npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=dist/game.js && cp index.html dist/
