FROM node:24-trixie

WORKDIR /app

COPY package*.json ./

RUN npm install --force --ignore-scripts

COPY . .

RUN npm run prisma:generate

EXPOSE 2003

CMD ["node", "index.js"]

# Build Comamnd
# docker build -t zibot .
