FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_BUILD_ID
ARG VITE_COMMIT_SHA
ENV VITE_BUILD_ID=$VITE_BUILD_ID
ENV VITE_COMMIT_SHA=$VITE_COMMIT_SHA
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/.server-dist ./.server-dist
EXPOSE 4173
CMD ["node", ".server-dist/server/index.js"]
