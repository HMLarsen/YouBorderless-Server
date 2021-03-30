FROM node:14.16.0

WORKDIR /app
COPY . .
RUN npm install

ENV NODE_ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json

CMD [ "npm", "start" ]