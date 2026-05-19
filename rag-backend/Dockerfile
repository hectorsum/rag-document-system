FROM node:20-alpine

WORKDIR /app

# Install dependencies (includes dev deps needed for prisma generate + build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

# Pre-download the embedding model so first request doesn't stall
RUN node -e " \
  const { pipeline } = require('@xenova/transformers'); \
  pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') \
    .then(() => { console.log('Model cached'); process.exit(0); }) \
    .catch(e => { console.error(e); process.exit(1); }); \
"

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Temp upload dir for multer
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "dist/main"]
