use rustrict::{Censor, Type};
use serde_json::Value;

use crate::{LabelVal, with_action};

/// Only terms rustrict rates as severe may bypass the decisions API.
const MIN_SEVERITY: Type = Type::SEVERE;

/// A function that returns labels for text, or `None` if the result is
/// ambiguous and must be decided by the model.
type LabelCheck = fn(&str) -> Option<Vec<LabelVal>>;

/// Map a rustrict analysis to labels without involving any real text.
///
/// Severe `mean` matches are ambiguous and return `None`: rustrict uses `mean`
/// for both ordinary insults and violent language, which need different labels.
fn labels_for_analysis(analysis: Type) -> Option<Vec<LabelVal>> {
    if analysis.is(Type::MEAN & MIN_SEVERITY) {
        return None;
    }

    let mut labels = Vec::new();
    if analysis.is((Type::PROFANE | Type::OFFENSIVE) & MIN_SEVERITY) {
        labels.push(LabelVal::Rude);
    }
    if analysis.is(Type::SEXUAL & MIN_SEVERITY) {
        labels.push(LabelVal::Porn);
    }

    Some(labels)
}

/// Labels rustrict can decide for one piece of text.
///
/// Returns `None` when the text contains an ambiguous severe `mean` match.
#[must_use]
fn text_labels(text: &str) -> Option<Vec<LabelVal>> {
    if text.trim().is_empty() {
        return Some(Vec::new());
    }

    let mut censor = Censor::from_str(text);
    censor
        .with_ignore_false_positives(false)
        .with_ignore_self_censoring(false);

    labels_for_analysis(censor.analyze())
}

/// Labels for every string value in a record, including `!hide`/`!warn`.
///
/// Object keys are not inspected. Any severe match in any field is enough for
/// the whole record to skip the decisions API, unless any field has an
/// ambiguous severe `mean` match.
#[must_use]
pub(crate) fn record_labels(record: &Value) -> Vec<LabelVal> {
    let mut labels = Vec::new();
    if collect(record, &mut labels, text_labels) {
        return Vec::new();
    }

    with_action(labels)
}

/// Collect labels, returning `true` if any value is ambiguous.
fn collect(value: &Value, labels: &mut Vec<LabelVal>, check: LabelCheck) -> bool {
    match value {
        Value::String(text) => match check(text) {
            Some(found) => {
                for label in found {
                    if !labels.contains(&label) {
                        labels.push(label);
                    }
                }
                false
            }
            None => true,
        },
        Value::Array(values) => values.iter().any(|value| collect(value, labels, check)),
        Value::Object(map) => map.values().any(|value| collect(value, labels, check)),
        Value::Null | Value::Bool(_) | Value::Number(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn severe_profanity_is_rude() {
        assert_eq!(
            labels_for_analysis(Type::PROFANE & Type::SEVERE),
            Some(vec![LabelVal::Rude])
        );
    }

    #[test]
    fn severe_offensive_is_rude() {
        assert_eq!(
            labels_for_analysis(Type::OFFENSIVE & Type::SEVERE),
            Some(vec![LabelVal::Rude])
        );
    }

    #[test]
    fn severe_sexual_is_porn() {
        assert_eq!(
            labels_for_analysis(Type::SEXUAL & Type::SEVERE),
            Some(vec![LabelVal::Porn])
        );
    }

    #[test]
    fn moderate_categories_are_not_fast_pathed() {
        assert_eq!(
            labels_for_analysis(Type::PROFANE & Type::MODERATE),
            Some(Vec::new())
        );
        assert_eq!(
            labels_for_analysis(Type::SEXUAL & Type::MODERATE),
            Some(Vec::new())
        );
    }

    #[test]
    fn severe_mean_is_ambiguous() {
        assert_eq!(labels_for_analysis(Type::MEAN & Type::SEVERE), None);
        assert_eq!(
            labels_for_analysis((Type::PROFANE | Type::MEAN) & Type::SEVERE),
            None
        );
    }

    #[test]
    fn benign_text_is_not_flagged() {
        assert_eq!(text_labels("A quiet walk by the river"), Some(Vec::new()));
        assert_eq!(text_labels(""), Some(Vec::new()));
    }

    /// A stand-in for `text_labels` so recursion can be tested without
    /// embedding real moderation terms in the source.
    fn fake_check(text: &str) -> Option<Vec<LabelVal>> {
        match text {
            "flagged" => Some(vec![LabelVal::Rude]),
            "unclear" => None,
            _ => Some(Vec::new()),
        }
    }

    #[test]
    fn collect_checks_nested_values() {
        let mut labels = Vec::new();

        assert!(!collect(
            &json!({ "tags": ["hiking", "flagged"] }),
            &mut labels,
            fake_check
        ));
        assert_eq!(labels, vec![LabelVal::Rude]);
    }

    #[test]
    fn ambiguous_value_makes_the_whole_record_fall_through() {
        let mut labels = Vec::new();

        assert!(collect(
            &json!({ "name": "flagged", "bio": "unclear" }),
            &mut labels,
            fake_check
        ));
    }

    #[test]
    fn benign_record_has_no_labels() {
        assert!(
            record_labels(&json!({
                "name": "Ben Nevis",
                "description": "A steep climb with a warning about the drop",
                "tags": ["munro", "scotland"],
            }))
            .is_empty()
        );
        assert!(record_labels(&json!({ "text": "A quiet walk by the river" })).is_empty());
    }
}
