FROM node:20-alpine

RUN apk add --no-cache nginx

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./server.js
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY public /usr/share/nginx/html

EXPOSE 80

CMD ["sh","-c","node /app/server.js & exec nginx -g 'daemon off;'"]
