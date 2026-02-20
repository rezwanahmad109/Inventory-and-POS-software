# syntax=docker/dockerfile:1.7

FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /app
ARG API_BASE_URL=/api

COPY . .

RUN set -eux; \
    if [ -f pubspec.yaml ]; then \
      flutter pub get; \
      flutter build web --release --dart-define=API_BASE_URL=${API_BASE_URL}; \
    else \
      mkdir -p build/web; \
      printf '%s\n' \
        '<!doctype html>' \
        '<html><head><meta charset="utf-8"><title>Inventory POS</title></head>' \
        '<body><h2>Flutter web build not found.</h2><p>Add pubspec.yaml and run flutter build web.</p></body></html>' \
        > build/web/index.html; \
    fi

FROM nginx:1.27-alpine AS production
WORKDIR /usr/share/nginx/html

COPY deploy/nginx/flutter-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web ./

EXPOSE 80
