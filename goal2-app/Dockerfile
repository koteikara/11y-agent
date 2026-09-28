FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY data ./data

ENV NODE_ENV=production
ENV PORT=8080
# Cloud Run ではすべての口で待ち受ける。手元(Windows 版など)の既定は 127.0.0.1(lib/local-guard.js)。
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["node", "server.js"]
