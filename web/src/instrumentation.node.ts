import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { NodeSDK } from "@opentelemetry/sdk-node";

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    serviceName: "attrails-web",
    instrumentations: [new PgInstrumentation(), new PinoInstrumentation()],
  });
  sdk.start();

  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
}
