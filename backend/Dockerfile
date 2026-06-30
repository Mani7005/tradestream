FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4000

# Wait for kafka/postgres to be ready is handled with retry logic in app code.
CMD ["node", "src/index.js"]
