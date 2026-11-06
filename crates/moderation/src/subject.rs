#[derive(PartialEq)]
pub enum Subject {
    Route {
        name: String,
        description: Option<String>,
        tags: Vec<String>,
    },
    Review {
        text: String,
    },
    Profile {
        name: String,
        bio: Option<String>,
    },
}

impl Subject {
    #[must_use]
    pub(crate) fn key(&self) -> &'static str {
        match self {
            Subject::Route { .. } => "route",
            Subject::Review { .. } => "review",
            Subject::Profile { .. } => "profile",
        }
    }

    fn text_content(&self) -> Vec<&str> {
        match self {
            Subject::Route {
                name,
                description,
                tags,
            } => {
                let mut texts: Vec<&str> = vec![name];
                if let Some(description) = description {
                    texts.push(description);
                }
                for tag in tags {
                    texts.push(tag);
                }
                texts
            }
            Subject::Review { text } => vec![text],
            Subject::Profile { name, bio } => {
                let mut texts: Vec<&str> = vec![name];
                if let Some(bio) = bio {
                    texts.push(bio);
                }

                texts
            }
        }
    }

    #[must_use]
    pub(crate) fn to_state(&self) -> serde_json::Value {
        match self {
            Subject::Route {
                name,
                description,
                tags,
            } => serde_json::json!({
                "route": {
                    "name": name,
                    "description": description,
                    "tags": tags
                }
            }),
            Subject::Review { text } => serde_json::json!({
                "review": {
                    "text": text
                }
            }),
            Subject::Profile { name, bio } => serde_json::json!({
                "profile": {
                    "name": name,
                    "bio": bio,
                }
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Subject;

    #[test]
    fn review_state_should_accurately_describe_it() {
        let review = Subject::Review {
            text: String::from("test"),
        };

        assert_eq!(
            review.to_state(),
            serde_json::json!({"review": { "text": "test" }})
        );
    }

    #[test]
    fn route_state_should_accurately_describe_it() {
        let route = Subject::Route {
            name: String::from("test-route"),
            description: Some(String::from("test-description")),
            tags: vec![String::from("test-tag")],
        };

        assert_eq!(
            route.to_state(),
            serde_json::json!({
                "route": {
                    "name": "test-route",
                    "description": "test-description",
                    "tags": ["test-tag"]
                }
            })
        );
    }

    #[test]
    fn profile_state_should_accurately_describe_it() {
        let profile = Subject::Profile {
            name: String::from("test-name"),
            bio: Some(String::from("test-bio")),
        };

        assert_eq!(
            profile.to_state(),
            serde_json::json!({
                "profile": {
                    "name": "test-name",
                    "bio": "test-bio",
                }
            })
        );
    }
}
