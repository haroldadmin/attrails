//! W3C trace context propagation through AMQP message headers.

use lapin::types::{AMQPValue, FieldTable, ShortString};
use opentelemetry::{
    global,
    propagation::{Extractor, Injector},
};
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;

struct HeaderInjector<'a>(&'a mut FieldTable);

impl Injector for HeaderInjector<'_> {
    fn set(&mut self, key: &str, value: String) {
        self.0
            .insert(ShortString::from(key), AMQPValue::LongString(value.into()));
    }
}

struct HeaderExtractor<'a>(&'a FieldTable);

impl Extractor for HeaderExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        match self.0.inner().get(key)? {
            AMQPValue::LongString(value) => std::str::from_utf8(value.as_bytes()).ok(),
            _ => None,
        }
    }

    fn keys(&self) -> Vec<&str> {
        self.0.inner().keys().map(ShortString::as_str).collect()
    }
}

/// Headers carrying the trace context of `span`.
pub(crate) fn inject(span: &Span) -> FieldTable {
    let mut headers = FieldTable::default();
    global::get_text_map_propagator(|propagator| {
        propagator.inject_context(&span.context(), &mut HeaderInjector(&mut headers));
    });
    headers
}

/// Make `span` a child of the trace context in `headers`, if there is one.
pub(crate) fn extract(span: &Span, headers: Option<&FieldTable>) {
    let Some(headers) = headers else {
        return;
    };
    let context =
        global::get_text_map_propagator(|propagator| propagator.extract(&HeaderExtractor(headers)));
    let _ = span.set_parent(context);
}

#[cfg(test)]
mod tests {
    use opentelemetry::trace::{TraceContextExt, TracerProvider};
    use opentelemetry_sdk::{propagation::TraceContextPropagator, trace::SdkTracerProvider};
    use tracing::info_span;
    use tracing_subscriber::layer::SubscriberExt;

    use super::*;

    #[test]
    fn extracted_span_continues_the_injected_trace() {
        global::set_text_map_propagator(TraceContextPropagator::new());
        let provider = SdkTracerProvider::builder().build();
        let subscriber = tracing_subscriber::registry()
            .with(tracing_opentelemetry::layer().with_tracer(provider.tracer("test")));

        tracing::subscriber::with_default(subscriber, || {
            let producer = info_span!("producer");
            let headers = inject(&producer);
            assert!(headers.contains_key("traceparent"));

            let consumer = info_span!("consumer");
            extract(&consumer, Some(&headers));

            let trace_id = |span: &Span| span.context().span().span_context().trace_id();
            assert_eq!(trace_id(&consumer), trace_id(&producer));
        });
    }
}
