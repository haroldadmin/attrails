use anyhow::{Result, anyhow};
use serde_json::{Map, Value};
use std::{collections::HashMap, fmt::Display, time::Duration};
use tracing::debug;

use crate::questions::{JUDGMENTS, TRUE_THRESHOLD};

mod questions;
mod typesafe;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LabelVal {
    // ATProto global values
    Hide,
    Warn,
    Porn,
    Sexual,
    Nudity,
    GraphicMedia,
    // ATTrails values
    Spam,
    Rude,
    Threat,
}

impl LabelVal {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            LabelVal::Hide => "!hide",
            LabelVal::Warn => "!warn",
            LabelVal::Porn => "porn",
            LabelVal::Sexual => "sexual",
            LabelVal::Nudity => "nudity",
            LabelVal::GraphicMedia => "graphic-media",
            LabelVal::Spam => "spam",
            LabelVal::Rude => "rude",
            LabelVal::Threat => "threat",
        }
    }
}

impl Display for LabelVal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Decide whether a record with the given content labels is hidden or shown
/// behind a warning.
fn action(content: &[LabelVal]) -> Option<LabelVal> {
    let hide = content
        .iter()
        .any(|label| matches!(label, LabelVal::Porn | LabelVal::Threat | LabelVal::Spam));

    if hide {
        Some(LabelVal::Hide)
    } else if content.is_empty() {
        None
    } else {
        Some(LabelVal::Warn)
    }
}

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
    /// `subject` names the record in the state sent to the API, such as
    /// `route`, so questions can refer to it directly. An empty list means
    /// the record needs no labels.
    ///
    /// # Errors
    ///
    /// Returns an error if the request fails, or the response is missing an
    /// answer to any question.
    pub async fn infer_labels(&self, subject: &str, record: Value) -> Result<Vec<LabelVal>> {
        let state = Value::Object(Map::from_iter([(subject.to_owned(), record)]));
        let questions = JUDGMENTS
            .iter()
            .map(|judgment| {
                let question = typesafe::Question::Noul {
                    instructions: judgment.instructions(subject),
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

        let mut labels: Vec<LabelVal> = probabilities
            .into_iter()
            .filter(|(_, probability)| *probability > TRUE_THRESHOLD)
            .map(|(label, _)| label)
            .collect();
        labels.extend(action(&labels));

        Ok(labels)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_table() {
        assert_eq!(action(&[]), None);
        assert_eq!(action(&[LabelVal::Rude]), Some(LabelVal::Warn));
        assert_eq!(
            action(&[LabelVal::Nudity, LabelVal::Sexual]),
            Some(LabelVal::Warn)
        );
        assert_eq!(
            action(&[LabelVal::Rude, LabelVal::Threat]),
            Some(LabelVal::Hide)
        );
        assert_eq!(action(&[LabelVal::Spam]), Some(LabelVal::Hide));
        assert_eq!(action(&[LabelVal::Porn]), Some(LabelVal::Hide));
    }

    #[test]
    fn questions_name_the_subject() {
        for judgment in &JUDGMENTS {
            let instructions = judgment.instructions("route");
            assert!(instructions.contains("`route`"), "{instructions}");
        }
    }
}
