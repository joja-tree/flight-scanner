FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY lib ./lib
COPY worker ./worker
RUN mkdir -p /app/worker/artifacts && chown -R pwuser:pwuser /app
USER pwuser
CMD ["npm", "run", "worker"]
