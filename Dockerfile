FROM node:12

WORKDIR /user/src/uems/micro-dionysus

EXPOSE 15550

CMD ["npm", "run", "start:old"]

COPY package*.json ./

RUN npm install

COPY . .
