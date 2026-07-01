import logging
from fastapi import FastAPI
from app.core.config import settings

logger = logging.getLogger(__name__)

# Dynamic imports for OpenTelemetry
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    logger.warning("OpenTelemetry libraries are not installed or failed to import.")

# Dynamic imports for Langfuse
try:
    from langfuse import Langfuse
    HAS_LANGFUSE = True
except ImportError:
    HAS_LANGFUSE = False
    logger.warning("Langfuse SDK is not installed or failed to import.")


def init_observability(app: FastAPI) -> None:
    """
    Initializes OpenTelemetry tracing and Langfuse client inside the FastAPI app.
    If Jaeger is down or endpoint is not set, fallback gracefully to no-op.
    """
    if not settings.ENABLE_OBSERVABILITY:
        logger.info("Observability is disabled via settings.")
        return

    # 1. OpenTelemetry Setup
    if HAS_OTEL and settings.JAEGER_OTLP_ENDPOINT:
        try:
            resource = Resource.create(attributes={"service.name": "botforweb-backend"})
            provider = TracerProvider(resource=resource)
            
            # Jaeger OTLP collector endpoint (usually grp://localhost:4317)
            otlp_exporter = OTLPSpanExporter(
                endpoint=settings.JAEGER_OTLP_ENDPOINT,
                insecure=True,
            )
            processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(processor)
            trace.set_tracer_provider(provider)
            
            # Instrument FastAPI
            FastAPIInstrumentor.instrument_app(app)
            logger.info("OpenTelemetry instrumentation successfully registered against Jaeger.")
        except Exception as e:
            logger.warning(f"Failed to initialize OpenTelemetry Jaeger exporter: {str(e)}. Proceeding without OTLP exports.")
    else:
        logger.info("OpenTelemetry Jaeger tracing is disabled (endpoint not configured or libraries missing).")


# Global Langfuse client wrapper
langfuse_client = None
if HAS_LANGFUSE and settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
    try:
        langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
        )
        logger.info("Langfuse tracking client initialized successfully.")
    except Exception as e:
        logger.warning(f"Failed to initialize Langfuse client: {str(e)}.")
else:
    logger.info("Langfuse credentials not set. Bypassing Langfuse logging.")
