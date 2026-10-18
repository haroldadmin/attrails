use anyhow::Result;
use serde::Deserialize;

const fn default_health_port() -> u16 {
    8080
}

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(rename = "attrails_tap_url")]
    pub tap_hostname: String,

    #[serde(rename = "attrails_tap_admin_password")]
    pub tap_admin_password: String,

    #[serde(rename = "attrails_rabbitmq_host")]
    pub rabbitmq_host: String,

    #[serde(rename = "attrails_health_port", default = "default_health_port")]
    pub health_port: u16,
}

impl Config {
    /// Read configuration from the environment.
    ///
    /// # Errors
    ///
    /// Returns an error if a required environment variable is missing or has
    /// an invalid value.
    pub fn from_env() -> Result<Config> {
        dotenvy::dotenv().ok();
        envy::from_env::<Config>().map_err(anyhow::Error::new)
    }
}
