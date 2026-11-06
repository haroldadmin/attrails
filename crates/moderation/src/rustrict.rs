use rustrict::{Censor, Type};

use crate::verdict::ContentLabel;

/// Only terms rustrict rates as severe may bypass the decisions API.
const MIN_SEVERITY: Type = Type::SEVERE;

fn analyze(text: &str) -> Type {
    let mut censor = Censor::from_str(text);
    censor.analyze()
}

fn to_labels(analysis: Type) -> Option<Vec<ContentLabel>> {
    if analysis.is(Type::NONE) {
        return None;
    }

    if analysis.is(Type::MEAN & MIN_SEVERITY) {
        return None;
    }

    let mut labels = Vec::new();
    if analysis.is((Type::PROFANE | Type::OFFENSIVE) & MIN_SEVERITY) {
        labels.push(ContentLabel::Rude);
    }

    if analysis.is(Type::SEXUAL & MIN_SEVERITY) {
        labels.push(ContentLabel::Porn);
    }

    if labels.is_empty() {
        None
    } else {
        Some(labels)
    }
}

/// Screens a given collection of text strings for profanity
/// and offensive content using rustrict.
///
/// A return value of `None` from this function must be considered
/// ambiguous, as it only implies that rustrict couldn't find an
/// obvious problem.
#[must_use]
pub fn screen(texts: &[&str]) -> Option<Vec<ContentLabel>> {
    let analysis = texts
        .iter()
        .fold(Type::NONE, |all, text| all | analyze(text));

    to_labels(analysis)
}

#[cfg(test)]
mod tests {

    use crate::{Subject, verdict::ContentLabel};

    use super::{analyze, screen, to_labels};
    use rustrict::Type;

    #[test]
    fn empty_text_is_not_censored() {
        assert_eq!(analyze(""), Type::NONE);
    }

    #[test]
    fn severe_profanity_is_rude() {
        assert_eq!(
            to_labels(Type::PROFANE & Type::SEVERE),
            Some(vec![ContentLabel::Rude])
        );
    }

    #[test]
    fn severe_offensive_is_rude() {
        assert_eq!(
            to_labels(Type::OFFENSIVE & Type::SEVERE),
            Some(vec![ContentLabel::Rude])
        );
    }

    #[test]
    fn severe_sexual_is_porn() {
        assert_eq!(
            to_labels(Type::SEXUAL & Type::SEVERE),
            Some(vec![ContentLabel::Porn])
        );
    }

    #[test]
    fn moderate_categories_produce_no_labels() {
        assert_eq!(to_labels(Type::PROFANE & Type::MODERATE), None);
        assert_eq!(to_labels(Type::SEXUAL & Type::MODERATE), None);
    }

    #[test]
    fn severe_mean_is_ambiguous() {
        assert_eq!(to_labels(Type::MEAN & Type::SEVERE), None);
        assert_eq!(to_labels((Type::PROFANE | Type::MEAN) & Type::SEVERE), None);
    }

    #[test]
    fn benign_text_is_not_flagged() {
        assert_eq!(screen(&["A quiet walk by the river"]), None);
        assert_eq!(screen(&[]), None);
        assert_eq!(screen(&[""]), None);
    }

    #[test]
    fn benign_record_has_no_labels() {
        let subject = Subject::Route {
            name: String::from("Ben Nevis"),
            description: Some(String::from("A steep climb with a warning about the drop")),
            tags: vec![String::from("scotland")],
        };

        assert_eq!(screen(&subject.text_content()), None);
    }
}
