FROM node:22-alpine AS builder

RUN apk add --no-cache git python3 make g++ linux-headers opus-dev

WORKDIR /build
COPY package.json tsconfig.json binding.gyp ./
COPY src/ src/
RUN npm install && npm run build

FROM node:22-alpine

RUN apk add --no-cache ffmpeg yt-dlp python3 ca-certificates opus

WORKDIR /app
COPY --from=builder /build/dist/ dist/
COPY --from=builder /build/build/Release/sonata_native.node dist/sonata_native.node
COPY --from=builder /build/node_modules/ node_modules/
COPY package.json .

EXPOSE 2333

ENTRYPOINT ["node", "dist/index.js"]
