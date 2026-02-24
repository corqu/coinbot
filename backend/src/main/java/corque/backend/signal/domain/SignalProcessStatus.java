package corque.backend.signal.domain;

public enum SignalProcessStatus {
    RECEIVED,
    PROCESSED,
    PARTIAL_FAILED,
    FAILED,
    IGNORED
}
