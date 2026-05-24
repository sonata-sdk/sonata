FROM node:22-alpine AS builder

RUN apk add --no-cache git python3

WORKDIR /build
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ src/
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache ffmpeg yt-dlp python3 ca-certificates

WORKDIR /app
COPY --from=builder /build/dist/ dist/
COPY --from=builder /build/node_modules/ node_modules/
COPY package.json .

EXPOSE 2333

ENTRYPOINT ["node", "dist/index.js"]
