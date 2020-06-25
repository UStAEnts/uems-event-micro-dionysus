FROM node:12

WORKDIR /user/src/uems/micro-dionysus

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 15550
CMD ["node", "app.js"]