package corque.backend.strategy.signal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class StrategySignalConsumer {

    private final SignalExecutionService signalExecutionService;

    @KafkaListener(topics = "${trading.signal-topic}")
    public void consumeSignal(TradeSignalMessage message) {
        try {
            signalExecutionService.executeSignal(message);
        } catch (Exception e) {
            log.error("Signal consume failed. message={}", message, e);
            throw e;
        }
    }
}

