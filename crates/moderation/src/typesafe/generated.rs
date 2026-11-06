#![allow(clippy::redundant_closure_call)]
#![allow(clippy::needless_lifetimes)]
#![allow(clippy::match_single_binding)]
#![allow(clippy::clone_on_copy)]

#[doc = "An answer whose type matches the corresponding question."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum Answer {
    NoulAnswer(NoulAnswer),
    ChoiceAnswer(ChoiceAnswer),
    ScoreAnswer(ScoreAnswer),
    BoxAnswer(BoxAnswer),
}
impl ::std::convert::From<NoulAnswer> for Answer {
    fn from(value: NoulAnswer) -> Self {
        Self::NoulAnswer(value)
    }
}
impl ::std::convert::From<ChoiceAnswer> for Answer {
    fn from(value: ChoiceAnswer) -> Self {
        Self::ChoiceAnswer(value)
    }
}
impl ::std::convert::From<ScoreAnswer> for Answer {
    fn from(value: ScoreAnswer) -> Self {
        Self::ScoreAnswer(value)
    }
}
impl ::std::convert::From<BoxAnswer> for Answer {
    fn from(value: BoxAnswer) -> Self {
        Self::BoxAnswer(value)
    }
}
#[doc = "An image that replaces its placeholder: its bytes in data_base64 with their format, or, in a multipart request, the name of the image part that holds them. Requests with images must send the header TypeSafe-Danger-Zone-Images: true."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug, Default)]
pub struct Asset {
    #[doc = "Base64-encoded image data."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub data_base64: ::std::option::Option<::std::string::String>,
    #[doc = "The image format, required with data_base64. The actual format is detected from the bytes."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub format: ::std::option::Option<Format>,
    #[doc = "In a multipart request, the name of the image part this asset uses. With part, data_base64 is ignored."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub part: ::std::option::Option<::std::string::String>,
    #[doc = "Identifies an image asset."]
    #[serde(
        rename = "type",
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub type_: ::std::option::Option<::std::string::String>,
}
#[doc = "A located box with normalized edge coordinates and confidence."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct BoxAnswer {
    #[doc = "The box's edges as fractions of image height and width, from 0 to 1. Each coordinate is the expected value of its edge's predicted position."]
    #[serde(rename = "box")]
    pub box_: BoxCoordinates,
    #[doc = "Confidence for the given box, from 0 to 1, with 1 being more confident. Null when the model does not provide confidence."]
    #[serde(deserialize_with = "::std::option::Option::deserialize")]
    pub confidence: ::std::option::Option<f64>,
    #[doc = "Identifies a box answer."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "Normalized box edges. Vertical coordinates are measured from the top of the image; horizontal coordinates are measured from the left."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct BoxCoordinates {
    #[doc = "Bottom edge of the box, as a fraction of image height from the top (0-1)."]
    pub bottom: f64,
    #[doc = "Left edge of the box, as a fraction of image width from the left (0-1)."]
    pub left: f64,
    #[doc = "Right edge of the box, as a fraction of image width from the left (0-1)."]
    pub right: f64,
    #[doc = "Top edge of the box, as a fraction of image height from the top (0-1)."]
    pub top: f64,
}
#[doc = "A question that locates what its instructions describe in the request's image. Requests with box questions must send the header TypeSafe-Danger-Zone-Images: true."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct BoxQuestion {
    #[doc = "What to locate in the image."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub instructions: ::std::option::Option<Instructions>,
    #[doc = "Identifies a box question."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "The selected choice, confidence, and probabilities for a choice question."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ChoiceAnswer {
    #[doc = "The name of the choice with the highest probability among the question's criteria."]
    pub choice: ::std::string::String,
    #[doc = "Confidence in the selected choice, from 0 to 1. Higher values indicate greater certainty; use lower values to flag uncertain selections for review."]
    pub confidence: f64,
    #[doc = "Probability of each choice in criteria, keyed by choice name, from 0 to 1. Shows how likely the alternatives are; values sum to approximately 1."]
    pub probabilities: ::std::collections::HashMap<::std::string::String, f64>,
    #[doc = "Identifies a selection from the requested choices."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "A question that selects one option from the choices you define."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ChoiceQuestion {
    #[doc = "Choice names and descriptions of when each applies. A choice without a description is interpreted by its name alone."]
    pub criteria: ::std::collections::HashMap<::std::string::String, ChoiceQuestionCriteriaValue>,
    #[doc = "What the model should decide when choosing an option."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub instructions: ::std::option::Option<Instructions>,
    #[doc = "Identifies a question that selects one of the choices in criteria."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "`ChoiceQuestionCriteriaValue`"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum ChoiceQuestionCriteriaValue {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
    Null,
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>>
    for ChoiceQuestionCriteriaValue
{
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for ChoiceQuestionCriteriaValue {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "`CriteriaItem`"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum CriteriaItem {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>>
    for CriteriaItem
{
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for CriteriaItem {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "Explanation of the invalid request. String details and message fields are bounded, with shortened text ending with …."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum Detail {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>>
    for Detail
{
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
#[doc = "What counts as a no answer."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum False {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
    Null,
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>> for False {
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for False {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "The image format, required with data_base64. The actual format is detected from the bytes."]
#[derive(
    :: serde :: Deserialize,
    :: serde :: Serialize,
    Clone,
    Copy,
    Debug,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
)]
pub enum Format {
    #[serde(rename = "png")]
    Png,
    #[serde(rename = "jpg")]
    Jpg,
    #[serde(rename = "jpeg")]
    Jpeg,
}
impl ::std::fmt::Display for Format {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Png => f.write_str("png"),
            Self::Jpg => f.write_str("jpg"),
            Self::Jpeg => f.write_str("jpeg"),
        }
    }
}
impl ::std::str::FromStr for Format {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "png" => Ok(Self::Png),
            "jpg" => Ok(Self::Jpg),
            "jpeg" => Ok(Self::Jpeg),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for Format {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for Format {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
#[doc = "Application validation failures returned with HTTP status 400."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct HttpBadRequestError {
    #[doc = "Explanation of the invalid request. String details and message fields are bounded, with shortened text ending with …."]
    pub detail: Detail,
}
#[doc = "Request validation failures returned with HTTP status 422."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug, Default)]
pub struct HttpValidationError {
    #[doc = "Validation errors describing which request values are missing or invalid."]
    #[serde(default, skip_serializing_if = "::std::vec::Vec::is_empty")]
    pub detail: ::std::vec::Vec<ValidationError>,
}
#[doc = "What to locate in the image."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum Instructions {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
    Null,
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>>
    for Instructions
{
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for Instructions {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "`LocationItem`"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum LocationItem {
    String(::std::string::String),
    Integer(i64),
}
impl ::std::fmt::Display for LocationItem {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match self {
            Self::String(x) => x.fmt(f),
            Self::Integer(x) => x.fmt(f),
        }
    }
}
impl ::std::convert::From<i64> for LocationItem {
    fn from(value: i64) -> Self {
        Self::Integer(value)
    }
}
#[doc = "A model or model alias available to the authenticated account."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ModelMetadata {
    #[doc = "Human-readable description of the model and its capabilities."]
    pub description: ::std::string::String,
    #[doc = "Model name or alias accepted by the request's model field."]
    pub name: ::std::string::String,
    #[doc = "Model release date, formatted as YYYY-MM-DD."]
    pub release_date: ::std::string::String,
}
#[doc = "Models and aliases available to the authenticated account."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ModelMetadataList {
    #[doc = "Available models and aliases. Use a model's name in POST /v1/systemone requests."]
    pub models: ::std::vec::Vec<ModelMetadata>,
}
#[doc = "The probability of a yes answer or a true statement."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct NoulAnswer {
    #[doc = "Probability of a yes answer or a true statement, from 0 to 1. Values near 1 favor yes or true, values near 0 favor no or false, and values near 0.5 indicate uncertainty."]
    pub noul: f64,
    #[doc = "Identifies a yes/no answer."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "Criteria defining what counts as a yes or no answer."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug, Default)]
pub struct NoulCriteria {
    #[doc = "What counts as a no answer."]
    #[serde(
        rename = "false",
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub false_: ::std::option::Option<False>,
    #[doc = "What counts as a yes answer."]
    #[serde(
        rename = "true",
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub true_: ::std::option::Option<True>,
}
#[doc = "A yes/no question or statement, answered with the probability of yes or true."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct NoulQuestion {
    #[doc = "Criteria clarifying what counts as a yes or no answer."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub criteria: ::std::option::Option<NoulCriteria>,
    #[doc = "The yes/no question or statement to evaluate."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub instructions: ::std::option::Option<Instructions>,
    #[doc = "Identifies a yes/no question or statement."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "A question about the supplied content."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum Question {
    NoulQuestion(NoulQuestion),
    ChoiceQuestion(ChoiceQuestion),
    ScoreQuestion(ScoreQuestion),
    BoxQuestion(BoxQuestion),
}
impl ::std::convert::From<NoulQuestion> for Question {
    fn from(value: NoulQuestion) -> Self {
        Self::NoulQuestion(value)
    }
}
impl ::std::convert::From<ChoiceQuestion> for Question {
    fn from(value: ChoiceQuestion) -> Self {
        Self::ChoiceQuestion(value)
    }
}
impl ::std::convert::From<ScoreQuestion> for Question {
    fn from(value: ScoreQuestion) -> Self {
        Self::ScoreQuestion(value)
    }
}
impl ::std::convert::From<BoxQuestion> for Question {
    fn from(value: BoxQuestion) -> Self {
        Self::BoxQuestion(value)
    }
}
#[doc = "An expected score with its rubric, confidence, and score-level probabilities."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ScoreAnswer {
    #[doc = "Confidence in the score, from 0 to 1. Higher values indicate greater certainty; use lower values to flag uncertain ratings for review."]
    pub confidence: f64,
    #[doc = "The requested criteria mapped to their score levels, so you can interpret the score."]
    pub legend: ::std::collections::HashMap<::std::string::String, ScoreAnswerLegendValue>,
    #[doc = "Probability of each score level, from 0 to 1, using the same keys as legend. Shows how likely the alternatives are; values sum to approximately 1."]
    pub probabilities: ::std::collections::HashMap<::std::string::String, f64>,
    #[doc = "Expected score: the probability-weighted average of the rubric levels. May fall between integer levels."]
    pub score: f64,
    #[doc = "Identifies a rating against the requested score levels."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "`ScoreAnswerLegendValue`"]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum ScoreAnswerLegendValue {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>>
    for ScoreAnswerLegendValue
{
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for ScoreAnswerLegendValue {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "A question that assigns a score using an ordered rubric."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ScoreQuestion {
    #[doc = "Ordered descriptions of the score levels. Each description's position determines its score, starting at zero."]
    pub criteria: ::std::vec::Vec<CriteriaItem>,
    #[doc = "What the model should rate."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub instructions: ::std::option::Option<Instructions>,
    #[doc = "Identifies a question that rates the content using the levels in criteria."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = "The content all questions in this request refer to."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum State {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>> for State {
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for State {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "Content and named questions to evaluate together using a TypeSafe model."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct SystemOneRequest {
    #[doc = "Media assets keyed by an opaque placeholder (recommend a per-image UUID). Each placeholder, wherever it appears as or inside a string in state, question instructions, or criteria, is replaced with the asset. Image assets require a vision-language model."]
    #[serde(
        default,
        skip_serializing_if = ":: std :: collections :: HashMap::is_empty"
    )]
    pub assets: ::std::collections::HashMap<::std::string::String, Asset>,
    #[doc = "Name or alias of the model to use. Available names are returned by GET /v1/models."]
    pub model: ::std::string::String,
    #[doc = "Questions to ask about the content, each with a name you choose. The response uses those names to identify the answers."]
    pub questions: ::std::collections::HashMap<::std::string::String, Question>,
    #[doc = "The content all questions in this request refer to."]
    pub state: State,
}
#[doc = "Answers grouped by question name, with the model used and token usage."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct SystemOneResponse {
    #[doc = "Answers keyed by the question names supplied in the request. Each answer's type matches its question's type."]
    pub answers: ::std::collections::HashMap<::std::string::String, Answer>,
    #[doc = "Name of the model that answered the questions. May differ from the alias supplied in the request."]
    pub model: ::std::string::String,
    #[doc = "Input and output token counts for this evaluation."]
    pub usage: Usage,
}
#[doc = "What counts as a yes answer."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum True {
    String(::std::string::String),
    Object(::serde_json::Map<::std::string::String, ::serde_json::Value>),
    Array(::std::vec::Vec<::serde_json::Value>),
    Null,
}
impl ::std::convert::From<::serde_json::Map<::std::string::String, ::serde_json::Value>> for True {
    fn from(value: ::serde_json::Map<::std::string::String, ::serde_json::Value>) -> Self {
        Self::Object(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::serde_json::Value>> for True {
    fn from(value: ::std::vec::Vec<::serde_json::Value>) -> Self {
        Self::Array(value)
    }
}
#[doc = "Token usage for the request."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct Usage {
    #[doc = "Number of billable input tokens used to evaluate the request."]
    pub input_tokens: i64,
    #[doc = "Number of output tokens used to answer the questions. Output tokens are currently free of charge."]
    pub output_tokens: i64,
}
#[doc = "A request validation error at a specific field or array element."]
#[derive(:: serde :: Deserialize, :: serde :: Serialize, Clone, Debug)]
pub struct ValidationError {
    #[doc = "Additional context used to explain the validation failure. Entries may be omitted or shortened."]
    #[serde(default, skip_serializing_if = "::serde_json::Map::is_empty")]
    pub ctx: ::serde_json::Map<::std::string::String, ::serde_json::Value>,
    #[doc = "Text preview of the rejected input. May be shortened with …."]
    #[serde(skip_serializing_if = "::std::option::Option::is_none")]
    pub input: ::std::option::Option<::std::string::String>,
    #[doc = "Path to the invalid value: the request location followed by field names and array indices. May be empty."]
    pub loc: ::std::vec::Vec<LocationItem>,
    #[doc = "Human-readable explanation of the validation failure. May be shortened with …."]
    pub msg: ::std::string::String,
    #[doc = "Machine-readable validation error code."]
    #[serde(rename = "type")]
    pub type_: ::std::string::String,
}
#[doc = " Error types."]
pub mod error {
    #[doc = r" Error from a `TryFrom` or `FromStr` implementation."]
    pub struct ConversionError(::std::borrow::Cow<'static, str>);
    impl ::std::error::Error for ConversionError {}
    impl ::std::fmt::Display for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Display::fmt(&self.0, f)
        }
    }
    impl ::std::fmt::Debug for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Debug::fmt(&self.0, f)
        }
    }
    impl From<&'static str> for ConversionError {
        fn from(value: &'static str) -> Self {
            Self(value.into())
        }
    }
    impl From<String> for ConversionError {
        fn from(value: String) -> Self {
            Self(value.into())
        }
    }
}
