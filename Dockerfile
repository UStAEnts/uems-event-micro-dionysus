FROM node:12

WORKDIR /user/src/uems/micro-dionysus

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 15670
CMD ["node", "app.js"]