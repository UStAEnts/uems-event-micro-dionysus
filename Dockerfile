FROM node:12

WORKDIR /user/src/uems/micro-dionysus

EXPOSE 15550

COPY package*.json ./

RUN npm install

COPY . .

RUN npm build

CMD ["npm", "run", "start"]