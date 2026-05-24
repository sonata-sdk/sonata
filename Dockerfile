FROM node:22-alpine

RUN apk add --no-cache ffmpeg ca-certificates

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY dist/ dist/
COPY config.example.js .

EXPOSE 2333

ENTRYPOINT ["node", "dist/index.js"]
