/* instrumentation.ts */
import { NodeSDK, } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter, } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

export class Instrumentation {
    private sdk: NodeSDK;
  
    constructor() {
      this.sdk = new NodeSDK({
           traceExporter: new OTLPTraceExporter({
              url: "http://localhost:4318/v1/traces",
            }),    instrumentations: [getNodeAutoInstrumentations()],
            resource: new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: "pepr",
                [SemanticResourceAttributes.SERVICE_VERSION]: "0.0.1" // XXX: BDW: test
            }),
      })
      
    }

    start() {
      this.sdk.start();
    }
  
    // Optional: You might want to add a method to stop the SDK
    stop() {
      this.sdk.shutdown();
    }
  }
  