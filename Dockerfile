# Multi-stage production Dockerfile for Evolvia
FROM node:18-alpine

WORKDIR /app

# Copy backend package manifests
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# Copy entire application
WORKDIR /app
COPY backend ./backend
COPY company_website ./company_website

# Expose server port
EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["node", "server.js"]
