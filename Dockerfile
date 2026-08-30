FROM node:24-trixie

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

RUN npm install --force

COPY . .

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=false

RUN npm run prisma:generate

EXPOSE 2003

CMD ["node", "index.js"]

# Build Comamnd
# docker build -t zibot .
