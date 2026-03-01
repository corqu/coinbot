package corque.backend.signal.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@Entity
@Table(
        name = "signal_event",
        indexes = {
                @Index(name = "idx_signal_event_signal_id", columnList = "signal_id"),
                @Index(name = "idx_signal_event_group_id", columnList = "group_id"),
                @Index(name = "idx_signal_event_status", columnList = "status"),
                @Index(name = "idx_signal_event_created_at", columnList = "created_at")
        }
)
public class SignalEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signal_id", length = 120)
    private String signalId;

    @Column(length = 30)
    private String type;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "strategy_id", length = 100)
    private String strategyId;

    @Column(length = 30)
    private String symbol;

    @Column(name = "interval_value", length = 30)
    private String intervalValue;

    @Column(length = 10)
    private String signal;

    private Double price;

    @Column(name = "signal_ts")
    private Long signalTs;

    @Lob
    @Column(name = "payload_json", columnDefinition = "TEXT")
    private String payloadJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SignalProcessStatus status;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public SignalEvent(
            String signalId,
            String type,
            Long userId,
            Long groupId,
            String strategyId,
            String symbol,
            String intervalValue,
            String signal,
            Double price,
            Long signalTs,
            String payloadJson,
            SignalProcessStatus status
    ) {
        this.signalId = signalId;
        this.type = type;
        this.userId = userId;
        this.groupId = groupId;
        this.strategyId = strategyId;
        this.symbol = symbol;
        this.intervalValue = intervalValue;
        this.signal = signal;
        this.price = price;
        this.signalTs = signalTs;
        this.payloadJson = payloadJson;
        this.status = status;
    }

    public void markProcessed(SignalProcessStatus status, String errorMessage) {
        this.status = status;
        this.errorMessage = errorMessage;
        this.processedAt = LocalDateTime.now();
    }
}
