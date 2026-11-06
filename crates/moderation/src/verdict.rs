use std::fmt::Display;

#[derive(Ord, Eq, PartialEq, PartialOrd, Debug, Copy, Clone, Hash)]
pub enum ContentLabel {
    Porn,
    Sexual,
    Nudity,
    GraphicMedia,
    Spam,
    Rude,
    Threat,
}

impl ContentLabel {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            ContentLabel::Porn => "porn",
            ContentLabel::Sexual => "sexual",
            ContentLabel::Nudity => "nudity",
            ContentLabel::GraphicMedia => "graphic-media",
            ContentLabel::Spam => "spam",
            ContentLabel::Rude => "rude",
            ContentLabel::Threat => "threat",
        }
    }
}

impl Display for ContentLabel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, PartialEq, Copy, Clone)]
pub enum Action {
    Hide,
    Warn,
}

impl Action {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Hide => "!hide",
            Self::Warn => "!warn",
        }
    }

    #[must_use]
    pub fn for_labels(labels: &[ContentLabel]) -> Option<Self> {
        if labels.is_empty() {
            return None;
        }

        for label in labels {
            if let ContentLabel::Porn | ContentLabel::Threat | ContentLabel::Spam = label {
                return Some(Self::Hide);
            }
        }

        Some(Self::Warn)
    }
}

pub enum Source {
    Rustrict,
    Jev,
}

impl Source {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Source::Rustrict => "rustrict",
            Source::Jev => "jev",
        }
    }
}

pub struct Verdict {
    pub content: Vec<ContentLabel>,
    pub action: Option<Action>,
    pub source: Source,
}

impl Verdict {
    #[must_use]
    pub fn new(mut content: Vec<ContentLabel>, source: Source) -> Self {
        content.sort();
        let action = Action::for_labels(&content);

        Self {
            content,
            action,
            source,
        }
    }

    #[must_use]
    pub fn vals(&self) -> Vec<&'static str> {
        self.content
            .iter()
            .map(|l| l.as_str())
            .chain(self.action.as_ref().map(|a| a.as_str()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use crate::verdict::{Action, ContentLabel};

    #[test]
    fn empty_set_of_labels_should_result_in_no_action() {
        let action = Action::for_labels(&[]);
        assert_eq!(action, None);
    }

    #[test]
    fn non_severe_label_should_result_in_a_warning() {
        let action = Action::for_labels(&[ContentLabel::Rude]);
        assert_eq!(action, Some(Action::Warn));

        let action = Action::for_labels(&[ContentLabel::Rude, ContentLabel::Sexual]);
        assert_eq!(action, Some(Action::Warn));
    }

    #[test]
    fn severe_label_should_result_in_hiding() {
        let action = Action::for_labels(&[ContentLabel::Porn]);
        assert_eq!(action, Some(Action::Hide));

        let action = Action::for_labels(&[ContentLabel::Porn, ContentLabel::Threat]);
        assert_eq!(action, Some(Action::Hide));
    }
}
