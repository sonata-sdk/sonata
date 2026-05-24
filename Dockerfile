FROM node:22-alpine AS builder

RUN apk add --no-cache ffmpeg ca-certificates python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json .
COPY src/ src/
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache ffmpeg ca-certificates

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production --ignore-scripts
COPY --from=builder /app/dist/ dist/
COPY config.example.js .

EXPOSE 2333

ENTRYPOINT ["node", "dist/index.js"]
