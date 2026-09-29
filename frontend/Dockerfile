FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# Find the Angular output directory containing index.html
RUN INDEX_DIR=$(dirname "$(find dist -type f -name index.html | head -n 1)") && \
    echo "Angular output directory: $INDEX_DIR" && \
    mkdir -p /tmp/site && \
    cp -r "$INDEX_DIR"/. /tmp/site/

FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

COPY --from=build /tmp/site/ /usr/share/nginx/html/

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80