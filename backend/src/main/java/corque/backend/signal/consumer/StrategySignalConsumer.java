package corque.backend.signal.consumer;

import corque.backend.signal.domain.SignalEvent;
import corque.backend.signal.domain.SignalProcessStatus;
import corque.backend.signal.dto.TradeSignalMessage;
import corque.backend.signal.service.SignalArchiveService;
import corque.backend.signal.service.SignalExecutionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StrategySignalConsumer {

    private final SignalExecutionService signalExecutionService;
    private final SignalArchiveService signalArchiveService;

    @KafkaListener(topics = "${trading.signal-topic}")
    public void consumeSignal(TradeSignalMessage message) {
        SignalEvent signalEvent = signalArchiveService.archive(message);
        try {
            SignalProcessStatus status = signalExecutionService.executeSignal(signalEvent.getId(), message);
            signalArchiveService.markProcessed(signalEvent.getId(), status, null);
        } catch (Exception e) {
            signalArchiveService.markProcessed(signalEvent.getId(), SignalProcessStatus.FAILED, e.getMessage());
            log.error("Signal consume failed. message={}", message, e);
            throw e;
        }
    }
}

