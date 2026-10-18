use std::net::SocketAddr;

use anyhow::anyhow;
use lifecycle::health::{Readiness, Server, check};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
};

async fn start(readiness: Readiness) -> (SocketAddr, Server) {
    let server = Server::bind(0, readiness)
        .await
        .expect("failed to bind probe listener");

    (server.local_addr(), server)
}

async fn request(addr: SocketAddr, path: &str) -> (u16, String) {
    let mut stream = TcpStream::connect(addr)
        .await
        .expect("failed to connect to probe server");

    stream
        .write_all(
            format!("GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
                .as_bytes(),
        )
        .await
        .expect("failed to send request");

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .await
        .expect("failed to read response");

    let (head, body) = response
        .split_once("\r\n\r\n")
        .expect("response is missing headers");
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse().ok())
        .expect("invalid or missing status code");

    (status, body.to_string())
}

async fn get(addr: SocketAddr, path: &str) -> (u16, serde_json::Value) {
    let (status, body) = request(addr, path).await;
    let body = serde_json::from_str(&body).expect("response body is not valid JSON");

    (status, body)
}

#[tokio::test]
async fn liveness_is_ok_before_startup_and_while_draining() {
    let readiness = Readiness::new();
    let (addr, server) = start(readiness.clone()).await;

    assert_eq!(request(addr, "/health/live").await.0, 200);

    readiness.mark_draining();
    assert_eq!(request(addr, "/health/live").await.0, 200);

    server.shutdown().await.expect("probe server failed");
}

#[tokio::test]
async fn readiness_tracks_startup_checks_and_draining() {
    let readiness = Readiness::new();
    let (addr, server) = start(readiness.clone()).await;

    let (status, body) = get(addr, "/health/ready").await;
    assert_eq!(status, 503);
    assert_eq!(body["status"], "unavailable");
    assert_eq!(body["reason"], "starting");

    readiness.mark_started(vec![check("dependency", || async { Ok(()) })]);
    assert_eq!(get(addr, "/health/ready").await.0, 200);

    readiness.mark_draining();
    let (status, body) = get(addr, "/health/ready").await;
    assert_eq!(status, 503);
    assert_eq!(body["reason"], "draining");

    server.shutdown().await.expect("probe server failed");
}

#[tokio::test]
async fn failing_check_makes_readiness_unavailable() {
    let readiness = Readiness::new();
    readiness.mark_started(vec![check("postgres", || async {
        Err(anyhow!("connection refused"))
    })]);

    let (addr, server) = start(readiness).await;
    let (status, body) = get(addr, "/health/ready").await;

    assert_eq!(status, 503);
    assert_eq!(body["checks"][0]["name"], "postgres");
    assert_eq!(body["checks"][0]["status"], "unavailable");
    assert_eq!(body["checks"][0]["error"], "connection refused");

    server.shutdown().await.expect("probe server failed");
}

#[tokio::test(start_paused = true)]
async fn hanging_checks_return_timed_out() {
    let readiness = Readiness::new();
    readiness.mark_started(vec![check(
        "slow",
        std::future::pending::<anyhow::Result<()>>,
    )]);

    let (addr, server) = start(readiness).await;
    let (status, body) = get(addr, "/health/ready").await;

    assert_eq!(status, 503);
    assert_eq!(body["checks"][0]["error"], "timed out");

    server.shutdown().await.expect("probe server failed");
}
