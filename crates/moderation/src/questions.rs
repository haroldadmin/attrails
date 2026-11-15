use crate::verdict::ContentLabel;

/// Probability above which a judgment counts as true.
pub(crate) const TRUE_THRESHOLD: f64 = 0.7;

/// A yes/no judgment about a record that, when true, applies `label`.
pub(crate) struct Judgment {
    pub label: ContentLabel,
    instructions: &'static str,
    when_true: &'static str,
    when_false: &'static str,
}

impl Judgment {
    /// The question's instructions, with `{subject}` replaced by the state
    /// field the record is in.
    pub fn instructions(&self, subject: &str) -> String {
        self.instructions.replace("{subject}", subject)
    }

    pub fn when_true(&self) -> &'static str {
        self.when_true
    }

    pub fn when_false(&self) -> &'static str {
        self.when_false
    }
}

pub(crate) const JUDGMENTS: [Judgment; 7] = [
    Judgment {
        label: ContentLabel::Porn,
        instructions: "Does `{subject}` contain pornographic content?",
        when_true: "The subject shows or describes sexual acts explicitly, or advertises or links to pornography.",
        when_false: "The subject contains no explicit sexual images or descriptions and no links to pornography.",
    },
    Judgment {
        label: ContentLabel::Sexual,
        instructions: "Does `{subject}` contain sexually suggestive content?",
        when_true: "The subject makes sexual jokes, innuendo, or suggestive remarks, or shows people in sexually suggestive poses, without showing or describing sexual acts explicitly.",
        when_false: "The subject makes no sexual jokes, innuendo, or suggestive remarks, and shows no sexually suggestive poses.",
    },
    Judgment {
        label: ContentLabel::Nudity,
        instructions: "Does `{subject}` show or refer to people being nude?",
        when_true: "The subject shows naked people, or mentions people being naked, such as naked hiking or a nude beach.",
        when_false: "The subject neither shows nor mentions anyone being unclothed. Swimwear or shirtless hikers are not nudity.",
    },
    Judgment {
        label: ContentLabel::GraphicMedia,
        instructions: "Does `{subject}` show or describe gore or violence in graphic detail?",
        when_true: "The subject shows or describes injuries, blood, or violence in vivid detail.",
        when_false: "The subject shows or mentions no injuries or violence, or mentions them only in passing, such as a warning about a steep drop.",
    },
    Judgment {
        label: ContentLabel::Spam,
        instructions: "Is `{subject}` made to advertise a product, service, or website?",
        when_true: "The subject promotes something for sale or directs readers to a commercial site, including through promotional images.",
        when_false: "The subject describes an activity, place, or person without promoting anything. Mentioning a café or shop along a route is not advertising.",
    },
    Judgment {
        label: ContentLabel::Rude,
        instructions: "Does `{subject}` use insulting or offensive language or imagery?",
        when_true: "The subject contains slurs, insults, profanity, or offensive gestures or symbols aimed at people.",
        when_false: "The subject is polite or neutral. Blunt criticism of a route, such as calling it boring or badly marked, is not rude.",
    },
    Judgment {
        label: ContentLabel::Threat,
        instructions: "Does `{subject}` threaten or intimidate a person?",
        when_true: "The subject threatens violence or harm against a person or group, or tries to intimidate them.",
        when_false: "The subject contains no threats. Warnings about hazards such as traffic or wildlife are not threats.",
    },
];
