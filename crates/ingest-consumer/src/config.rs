use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(rename = "attrails_rabbitmq_host")]
    pub rabbitmq_host: String,
    #[serde(rename = "attrails_postgres_connection_uri")]
    pub postgres_uri: String,
}

impl Config {
    pub fn from_env() -> Result<Config> {
        dotenvy::dotenv().ok();
        envy::from_env::<Config>().map_err(anyhow::Error::new)
    }
}
