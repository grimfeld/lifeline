FROM alpine:3.20

ARG PB_VERSION=0.39.8
# The release zip's sha256, from that release's checksums.txt: bump it with the version.
ARG PB_SHA256=3b675575ff0e6dcc5befc85a9644aea6b04ac617ce125ecb2b6989a3c5b5664f

# PocketBase runs as `pb`, not root (entrypoint.sh drops to it).
RUN apk add --no-cache unzip ca-certificates su-exec \
 && addgroup -S pb && adduser -S -D -H -G pb -h /pb pb

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - && unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
COPY --chmod=755 entrypoint.sh /pb/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/pb/entrypoint.sh"]
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
