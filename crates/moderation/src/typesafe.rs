use std::{collections::HashMap, time::Duration};

use anyhow::Result;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::debug;

pub(crate) struct Client {
    base_url: reqwest::Url,
    client: reqwest::Client,
}

pub(crate) struct Config {
    pub api_key: String,
    pub base_url: String,
    pub timeout: Duration,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub(crate) enum Question {
    Noul {
        instructions: String,
        criteria: NoulCriteria,
    },
}

#[derive(Serialize)]
pub(crate) struct NoulCriteria {
    #[serde(rename = "true")]
    pub when_true: &'static str,
    #[serde(rename = "false")]
    pub when_false: &'static str,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "lowercase")]
pub(crate) enum Answer {
    Noul { noul: f32 },
}

#[derive(Serialize)]
struct Request {
    model: &'static str,
    state: Value,
    questions: HashMap<String, Question>,
}

#[derive(Deserialize)]
struct Response {
    answers: HashMap<String, Answer>,
}

impl Client {
    pub(crate) fn build(conf: &Config) -> Result<Self> {
        let mut auth = HeaderValue::from_str(&format!("Bearer {}", conf.api_key))?;
        auth.set_sensitive(true);
        let headers = HeaderMap::from_iter([(AUTHORIZATION, auth)]);

        let client = reqwest::ClientBuilder::new()
            .https_only(true)
            .timeout(conf.timeout)
            .default_headers(headers)
            .build()?;

        Ok(Self {
            base_url: conf.base_url.parse()?,
            client,
        })
    }

    pub(crate) async fn query(
        &self,
        state: Value,
        questions: HashMap<String, Question>,
    ) -> Result<HashMap<String, Answer>> {
        let req = Request {
            model: "jev:latest",
            state,
            questions,
        };
        let body = serde_json::to_string(&req)?;
        debug!(%body, "decisions api request");

        let url = self.base_url.join("/v1/systemone")?;
        let res = self
            .client
            .post(url)
            .header(CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .await?
            .error_for_status()?
            .json::<Response>()
            .await?;

        Ok(res.answers)
    }
}
