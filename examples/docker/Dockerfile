FROM node:20-slim
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/server.mjs ./
EXPOSE 3000
CMD ["node", "server.mjs"]
