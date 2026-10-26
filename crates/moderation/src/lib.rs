use anyhow::{Result, anyhow};
use serde_json::{Map, Value};
use std::{collections::HashMap, fmt::Display, hash::BuildHasher, time::Duration};
use tracing::{debug, instrument};

use crate::questions::{JUDGMENTS, TRUE_THRESHOLD};

mod fast_path;
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

/// Where the labels for a record came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LabelSource {
    /// Rustrict's local fast path.
    Rustrict,
    /// The decisions API.
    Jev,
}

impl LabelSource {
    /// The value stored in the `labels.source` column.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Rustrict => "rustrict",
            Self::Jev => "jev",
        }
    }
}

/// Labels for a record, and how they were decided.
#[derive(Debug, Clone)]
pub struct Inference {
    /// The labels to store, including `!hide` or `!warn`.
    pub labels: Vec<LabelVal>,
    /// Whether the labels came from rustrict or the decisions API.
    pub source: LabelSource,
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
    #[instrument(skip(self, record))]
    pub async fn infer_labels(&self, subject: &str, record: Value) -> Result<Inference> {
        let fast = fast_path::record_labels(&record);
        if !fast.is_empty() {
            debug!(?fast, "rustrict fast path applied");
            return Ok(Inference {
                labels: fast,
                source: LabelSource::Rustrict,
            });
        }

        let probabilities = self.judge(subject, record).await?;
        Ok(Inference {
            labels: labels(&probabilities),
            source: LabelSource::Jev,
        })
    }

    /// Ask the decisions API for the probability that each content label
    /// applies to `record`.
    ///
    /// # Errors
    ///
    /// Returns an error if the request fails, or the response is missing an
    /// answer to any question.
    pub async fn judge(&self, subject: &str, record: Value) -> Result<HashMap<LabelVal, f32>> {
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

        Ok(probabilities)
    }
}

/// Add `!hide` or `!warn` to a set of content labels.
pub(crate) fn with_action(mut labels: Vec<LabelVal>) -> Vec<LabelVal> {
    labels.extend(action(&labels));
    labels
}

/// Decide the labels for a record from the probability of each content
/// label: the content labels judged true, plus `!hide` or `!warn`.
#[must_use]
pub fn labels<S: BuildHasher>(probabilities: &HashMap<LabelVal, f32, S>) -> Vec<LabelVal> {
    let labels: Vec<LabelVal> = probabilities
        .iter()
        .filter(|(_, probability)| **probability > TRUE_THRESHOLD)
        .map(|(label, _)| *label)
        .collect();

    with_action(labels)
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
