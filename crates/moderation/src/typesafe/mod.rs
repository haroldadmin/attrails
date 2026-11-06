use std::{collections::HashMap, time::Duration};

use anyhow::{Result, anyhow};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use tracing::debug;

use crate::typesafe::generated::{
    False, Instructions, NoulCriteria, NoulQuestion, Question, SystemOneRequest, SystemOneResponse,
    True,
};

#[allow(clippy::all, clippy::pedantic, dead_code)]
mod generated;

pub use generated::{Answer, State};

pub(crate) struct Client {
    system_one_url: reqwest::Url,
    client: reqwest::Client,
}

pub(crate) struct Config {
    pub api_key: String,
    pub base_url: String,
    pub timeout: Duration,
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

        let base_url: reqwest::Url = conf.base_url.parse()?;
        let system_one_url = base_url.join("v1/systemone")?;

        Ok(Self {
            system_one_url,
            client,
        })
    }

    pub(crate) async fn query(
        &self,
        state: State,
        questions: HashMap<String, Question>,
    ) -> Result<HashMap<String, Answer>> {
        let req = SystemOneRequest {
            model: String::from("jev-latest"),
            state,
            questions,
            assets: HashMap::new(),
        };
        let body = serde_json::to_string(&req)?;
        debug!(%body, "decisions api request");

        let res = self
            .client
            .post(self.system_one_url.clone())
            .header(CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .await?;

        let status = res.status();
        if !status.is_success() {
            let detail = res.text().await.unwrap_or_default();
            return Err(anyhow!("decisions api returned {status}: {detail}"));
        }

        Ok(res.json::<SystemOneResponse>().await?.answers)
    }
}

pub fn noul(instructions: String, when_true: String, when_false: String) -> Question {
    Question::NoulQuestion(NoulQuestion {
        criteria: Some(NoulCriteria {
            true_: Some(True::String(when_true)),
            false_: Some(False::String(when_false)),
        }),
        instructions: Some(Instructions::String(instructions)),
        type_: String::from("noul"),
    })
}
