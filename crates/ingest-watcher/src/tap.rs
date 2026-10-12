use std::time::Duration;

use atproto_tap::{TapConfig, TapStream, connect};

pub fn listen(hostname: &str, admin_password: &str) -> TapStream {
    let tap_conf = TapConfig::builder()
        .hostname(hostname)
        .admin_password(admin_password)
        .send_acks(true)
        .max_reconnect_attempts(Some(10))
        .max_reconnect_delay(Duration::from_secs(60))
        .channel_buffer_size(64)
        .build();

    connect(tap_conf)
}
