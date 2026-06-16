FROM node:22-alpine

# Prisma query engine requires OpenSSL on Alpine (without this, DB queries fail at runtime).
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
