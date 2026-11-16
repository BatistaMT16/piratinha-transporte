FROM node:20-alpine

WORKDIR /app

ENV TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata wget

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000

CMD ["npm", "start"]
