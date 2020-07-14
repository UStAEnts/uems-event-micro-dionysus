FROM node:12

WORKDIR /user/src/uems/micro-dionysus

EXPOSE 15550

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "run", "start:old"]