docker run --rm -it \
  -v "$(pwd)":/app \
  -w /app \
  node:24-alpine \
  sh -lc "npx create-next-app@latest ."