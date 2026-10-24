use crate::LabelVal;

/// Probability above which a judgment counts as true.
pub(crate) const TRUE_THRESHOLD: f32 = 0.7;

/// A yes/no judgment about a record that, when true, applies `label`.
pub(crate) struct Judgment {
    pub label: LabelVal,
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
        label: LabelVal::Porn,
        instructions: "Does `{subject}` contain pornographic content?",
        when_true: "The text describes sexual acts explicitly, or advertises or links to pornography.",
        when_false: "The text contains no explicit sexual descriptions and no links to pornography.",
    },
    Judgment {
        label: LabelVal::Sexual,
        instructions: "Does `{subject}` contain sexually suggestive language?",
        when_true: "The text makes sexual jokes, innuendo, or suggestive remarks without describing sexual acts explicitly.",
        when_false: "The text makes no sexual jokes, innuendo, or suggestive remarks.",
    },
    Judgment {
        label: LabelVal::Nudity,
        instructions: "Does `{subject}` refer to people being nude?",
        when_true: "The text mentions people being naked, such as naked hiking or a nude beach.",
        when_false: "The text does not mention anyone being unclothed.",
    },
    Judgment {
        label: LabelVal::GraphicMedia,
        instructions: "Does `{subject}` describe gore or violence in graphic detail?",
        when_true: "The text describes injuries, blood, or violence in vivid detail.",
        when_false: "The text mentions no injuries or violence, or mentions them only in passing, such as a warning about a steep drop.",
    },
    Judgment {
        label: LabelVal::Spam,
        instructions: "Is `{subject}` written to advertise a product, service, or website?",
        when_true: "The text promotes something for sale or directs readers to a commercial site.",
        when_false: "The text describes an activity, place, or person without promoting anything. Mentioning a café or shop along a route is not advertising.",
    },
    Judgment {
        label: LabelVal::Rude,
        instructions: "Does `{subject}` use insulting or offensive language?",
        when_true: "The text contains slurs, insults, or profanity aimed at people.",
        when_false: "The text is polite or neutral. Blunt criticism of a route, such as calling it boring or badly marked, is not rude.",
    },
    Judgment {
        label: LabelVal::Threat,
        instructions: "Does `{subject}` threaten or intimidate a person?",
        when_true: "The text threatens violence or harm against a person or group, or tries to intimidate them.",
        when_false: "The text contains no threats. Warnings about hazards such as traffic or wildlife are not threats.",
    },
];
