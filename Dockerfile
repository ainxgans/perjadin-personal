# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Go backend
FROM golang:alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /perjadin ./cmd/server
RUN CGO_ENABLED=0 go build -o /seed ./cmd/seed

# Stage 3: Minimal runtime
FROM alpine:3.20
RUN apk add --no-cache ca-certificates poppler-utils && mkdir -p /app/uploads
WORKDIR /app
COPY --from=backend /perjadin .
COPY --from=backend /seed .
COPY internal/db/migrations ./internal/db/migrations
COPY Dinas ./Dinas
COPY --from=frontend /web/dist ./web/dist
EXPOSE 8080
CMD ["./perjadin"]
