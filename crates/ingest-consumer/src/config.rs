use anyhow::Result;
use serde::Deserialize;

const fn default_health_port() -> u16 {
    8081
}

fn default_decisions_api_base_url() -> String {
    String::from("https://api.typesafe.ai")
}

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(rename = "attrails_rabbitmq_host")]
    pub rabbitmq_host: String,
    #[serde(rename = "attrails_postgres_connection_uri")]
    pub postgres_uri: String,

    #[serde(rename = "attrails_health_port", default = "default_health_port")]
    pub health_port: u16,

    #[serde(
        rename = "attrails_decisions_api_base_url",
        default = "default_decisions_api_base_url"
    )]
    pub decisions_api_base_url: String,

    #[serde(rename = "attrails_decisions_api_key")]
    pub decisions_api_key: String,
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
