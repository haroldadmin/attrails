use crate::image::Image;

#[derive(PartialEq)]
pub enum Subject {
    Route {
        name: String,
        description: Option<String>,
        tags: Vec<String>,
        images: Vec<Image>,
    },
    Review {
        text: String,
        images: Vec<Image>,
    },
    Profile {
        name: String,
        bio: Option<String>,
        image: Option<Image>,
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

    pub(crate) fn text_content(&self) -> Vec<&str> {
        match self {
            Subject::Route {
                name,
                description,
                tags,
                images,
            } => {
                let mut texts: Vec<&str> = vec![name];
                if let Some(description) = description {
                    texts.push(description);
                }

                for tag in tags {
                    texts.push(tag);
                }

                for image in images {
                    texts.push(&image.alt);
                }

                texts
            }
            Subject::Review { text, images } => {
                let mut texts: Vec<&str> = vec![text];
                for image in images {
                    texts.push(&image.alt);
                }
                texts
            }
            Subject::Profile { name, bio, image } => {
                let mut texts: Vec<&str> = vec![name];
                if let Some(bio) = bio {
                    texts.push(bio);
                }

                if let Some(image) = image {
                    texts.push(&image.alt);
                }

                texts
            }
        }
    }

    #[must_use]
    pub(crate) fn images(&self) -> &[Image] {
        match self {
            Subject::Route { images, .. } | Subject::Review { images, .. } => images,
            Subject::Profile { image, .. } => image.as_slice(),
        }
    }

    #[must_use]
    pub(crate) fn to_state(&self) -> serde_json::Map<String, serde_json::Value> {
        match self {
            Subject::Route {
                name,
                description,
                tags,
                images,
            } => serde_json::map::Map::from_iter([(
                String::from("route"),
                serde_json::json!({
                    "name": name,
                    "description": description,
                    "tags": tags,
                    "images": images.iter().map(Image::to_state).collect::<Vec<serde_json::Value>>()
                }),
            )]),
            Subject::Review { text, images } => serde_json::map::Map::from_iter([(
                String::from("review"),
                serde_json::json!({
                    "text": text,
                    "images": images.iter().map(Image::to_state).collect::<Vec<serde_json::Value>>()
                }),
            )]),
            Subject::Profile { name, bio, image } => serde_json::map::Map::from_iter([(
                String::from("profile"),
                serde_json::json!({
                        "name": name,
                        "bio": bio,
                        "images": image.iter().map(Image::to_state).collect::<Vec<serde_json::Value>>()
                }),
            )]),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Subject;
    use crate::image::Image;

    #[test]
    fn review_state_should_accurately_describe_it() {
        let review = Subject::Review {
            text: String::from("test"),
            images: vec![Image::new("testimg", Vec::new(), "testalt")],
        };

        assert_eq!(
            serde_json::to_value(review.to_state()).expect("failed to serialise value"),
            serde_json::json!({"review": {
                "text": "test",
                "images": [
                    {
                        "image": "img-testimg",
                        "alt": "testalt"
                    }
                ]
            }})
        );
    }

    #[test]
    fn route_state_should_accurately_describe_it() {
        let route = Subject::Route {
            name: String::from("test-route"),
            description: Some(String::from("test-description")),
            tags: vec![String::from("test-tag")],
            images: vec![Image::new("testimg", Vec::new(), "testalt")],
        };

        assert_eq!(
            serde_json::to_value(route.to_state()).expect("failed to serialise value"),
            serde_json::json!({
                "route": {
                    "name": "test-route",
                    "description": "test-description",
                    "tags": ["test-tag"],
                    "images": [{
                        "image": "img-testimg",
                        "alt": "testalt"
                    }]
                }
            })
        );
    }

    #[test]
    fn profile_state_should_accurately_describe_it() {
        let profile = Subject::Profile {
            name: String::from("test-name"),
            bio: Some(String::from("test-bio")),
            image: Some(Image::new("testimg", Vec::new(), "testalt")),
        };

        assert_eq!(
            serde_json::to_value(profile.to_state()).expect("failed to serialise value"),
            serde_json::json!({
                "profile": {
                    "name": "test-name",
                    "bio": "test-bio",
                    "images": [{
                        "image": "img-testimg",
                        "alt": "testalt"
                    }]
                }
            })
        );
    }
}
