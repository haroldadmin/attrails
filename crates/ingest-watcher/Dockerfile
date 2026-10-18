# syntax=docker/dockerfile:1

# Build from the repository root, so the whole workspace is in the context:
#
#   docker build -f crates/ingest-watcher/Dockerfile -t attrails/ingest-watcher .
#
# The image is compiled natively for the build platform. Pass
# --platform linux/amd64 to build for the cluster from an arm64 machine; this
# runs under emulation and is much slower than a native build.

# Keep in sync with the rust version in mise.toml.
ARG RUST_VERSION=1.98.0
ARG CARGO_CHEF_VERSION=0.1.78

FROM rust:${RUST_VERSION}-trixie AS chef
ARG CARGO_CHEF_VERSION
RUN cargo install --locked cargo-chef --version ${CARGO_CHEF_VERSION}
WORKDIR /app

# Reduce the workspace to its manifests, so the dependency layer below is only
# rebuilt when dependencies change.
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json -p ingest-watcher
COPY . .
RUN cargo build --release --locked -p ingest-watcher

# distroless/cc provides glibc and the CA certificates that rustls loads from
# the system trust store.
FROM gcr.io/distroless/cc-debian13:nonroot
ENV RUST_LOG=info
COPY --from=builder /app/target/release/ingest-watcher /usr/local/bin/ingest-watcher
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/ingest-watcher"]
