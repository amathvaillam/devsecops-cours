FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Securite : le conteneur ne tourne plus en root
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 5000
# Sante : Docker verifie /health toutes les 30 s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1
CMD ["node", "server.js"]