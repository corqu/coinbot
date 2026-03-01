package corque.backend.signal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import corque.backend.signal.domain.SignalEvent;
import corque.backend.signal.domain.SignalProcessStatus;
import corque.backend.signal.dto.TradeSignalMessage;
import corque.backend.signal.repo.SignalEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SignalArchiveService {

    private final SignalEventRepository signalEventRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public SignalEvent archive(TradeSignalMessage message) {
        SignalEvent signalEvent = SignalEvent.builder()
                .signalId(message != null ? message.getSignalId() : null)
                .type(message != null ? message.getType() : null)
                .userId(message != null ? message.getUserId() : null)
                .groupId(message != null ? message.getGroupId() : null)
                .strategyId(message != null ? message.getStrategyId() : null)
                .symbol(message != null ? message.getSymbol() : null)
                .intervalValue(message != null ? message.getInterval() : null)
                .signal(message != null ? message.getSignal() : null)
                .price(message != null ? message.getPrice() : null)
                .signalTs(message != null ? message.getTs() : null)
                .payloadJson(toJson(message))
                .status(SignalProcessStatus.RECEIVED)
                .build();

        return signalEventRepository.save(signalEvent);
    }

    @Transactional
    public void markProcessed(Long signalEventId, SignalProcessStatus status, String errorMessage) {
        if (signalEventId == null) {
            return;
        }
        signalEventRepository.findById(signalEventId)
                .ifPresent(event -> event.markProcessed(status, truncate(errorMessage, 2000)));
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize signal payload", e);
            return null;
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
