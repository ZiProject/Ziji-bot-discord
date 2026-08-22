FROM node:24-trixie

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
