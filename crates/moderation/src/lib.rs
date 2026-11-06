use anyhow::{Result, anyhow};
use std::{collections::HashMap, time::Duration};
use tracing::{debug, instrument};

use crate::{
    questions::{JUDGMENTS, TRUE_THRESHOLD},
    verdict::{ContentLabel, Source, Verdict},
};

mod questions;
mod rustrict;
mod subject;
mod typesafe;
mod verdict;

pub use subject::Subject;

pub struct ModeratorConfig {
    pub decisions_api_base_url: String,
    pub decisions_api_key: String,
}

pub struct Moderator {
    client: typesafe::Client,
}

impl Moderator {
    /// Create a new Moderator instance
    ///
    /// # Errors
    ///
    /// Returns an error if the moderator's internal HTTP
    /// client could not be initialized.
    pub fn build(conf: ModeratorConfig) -> Result<Self> {
        let client = typesafe::Client::build(&typesafe::Config {
            api_key: conf.decisions_api_key,
            base_url: conf.decisions_api_base_url,
            timeout: Duration::from_secs(10),
        })?;

        Ok(Self { client })
    }

    /// Ask the decisions API which content labels apply to `record`, and add
    /// `!hide` or `!warn` if any do.
    ///
    /// Before calling the API, rustrict checks the record's text for severe
    /// profanity, offensive language, or sexual content. If it finds any, those
    /// labels are returned directly and the API is not called.
    ///
    /// `subject` names the record in the state sent to the API, such as
    /// `route`, so questions can refer to it directly. An empty list of labels
    /// means the record needs no labels.
    ///
    /// # Errors
    ///
    /// Returns an error if the request fails, or the response is missing an
    /// answer to any question.
    #[instrument(skip(self, subject))]
    pub async fn moderate(&self, subject: &Subject) -> Result<Verdict> {
        let rustrict_labels = rustrict::screen(&subject.text_content());
        if let Some(labels) = rustrict_labels {
            return Ok(Verdict::new(labels, Source::Rustrict));
        }

        let probabilities = self.judge(subject).await?;
        let labels: Vec<ContentLabel> = probabilities
            .iter()
            .filter(|(_, p)| **p >= TRUE_THRESHOLD)
            .map(|(l, _)| *l)
            .collect();

        Ok(Verdict::new(labels, Source::Jev))
    }

    /// Ask the decisions API for the probability that each content label
    /// applies to `record`.
    ///
    /// # Errors
    ///
    /// Returns an error if the request fails, or the response is missing an
    /// answer to any question.
    async fn judge(&self, subject: &Subject) -> Result<HashMap<ContentLabel, f32>> {
        let state = subject.to_state();
        let questions = JUDGMENTS
            .iter()
            .map(|judgment| {
                let question = typesafe::Question::Noul {
                    instructions: judgment.instructions(subject.key()),
                    criteria: typesafe::NoulCriteria {
                        when_true: judgment.when_true(),
                        when_false: judgment.when_false(),
                    },
                };
                (judgment.label.as_str().to_owned(), question)
            })
            .collect();

        let answers = self.client.query(state, questions).await?;
        let probabilities = JUDGMENTS
            .iter()
            .map(|judgment| match answers.get(judgment.label.as_str()) {
                Some(typesafe::Answer::Noul { noul }) => Ok((judgment.label, *noul)),
                None => Err(anyhow!(
                    "no answer for {} in decisions api response",
                    judgment.label
                )),
            })
            .collect::<Result<HashMap<_, _>>>()?;
        debug!(?probabilities, "decisions api answers");

        Ok(probabilities)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn questions_name_the_subject() {
        for judgment in &JUDGMENTS {
            let instructions = judgment.instructions("route");
            assert!(instructions.contains("`route`"), "{instructions}");
        }
    }
}
