FROM node:14

WORKDIR /user/src/uems/micro-dionysus

EXPOSE 15550

COPY package*.json ./

RUN npm install

COPY . /user/src/uems/micro-dionysus

RUN ls -la

RUN npm run build

ENV NODE_ENV=dev

CMD ["npm", "run", "start:old"]
