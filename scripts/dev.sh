docker run --rm -it \
  --name plog-app \
  -p 3000:3000 \
  -v "$(pwd)":/app \
  -w /app \
  node:24-alpine \
  sh -lc "npm install && npm run dev -- --hostname 0.0.0.0 --port 3000"