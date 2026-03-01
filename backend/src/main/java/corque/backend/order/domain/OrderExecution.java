package corque.backend.order.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@Entity
@Table(
        name = "order_execution",
        indexes = {
                @Index(name = "idx_order_exec_signal_id", columnList = "signal_id"),
                @Index(name = "idx_order_exec_order_id", columnList = "order_id"),
                @Index(name = "idx_order_exec_status", columnList = "status"),
                @Index(name = "idx_order_exec_created_at", columnList = "created_at")
        }
)
public class OrderExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signal_event_id")
    private Long signalEventId;

    @Column(name = "signal_id", length = 120)
    private String signalId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "group_id")
    private Long groupId;

    @Column(name = "strategy_group_item_id")
    private Long strategyGroupItemId;

    @Column(name = "strategy_code", length = 100)
    private String strategyCode;

    @Column(nullable = false, length = 30)
    private String symbol;

    @Column(name = "interval_value", length = 30)
    private String intervalValue;

    @Column(nullable = false, length = 10)
    private String signal;

    @Column(nullable = false, length = 10)
    private String side;

    @Column(name = "request_qty", nullable = false)
    private Double requestQty;

    @Column(name = "executed_qty")
    private Double executedQty;

    @Column(name = "remaining_qty")
    private Double remainingQty;

    @Column(name = "order_type", nullable = false, length = 10)
    private String orderType;

    @Column(name = "request_price")
    private Double requestPrice;

    @Column(name = "request_take_profit")
    private Double requestTakeProfit;

    @Column(name = "request_stop_loss")
    private Double requestStopLoss;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderExecutionStatus status;

    @Column(name = "ret_code")
    private Integer retCode;

    @Column(name = "ret_msg", length = 500)
    private String retMsg;

    @Column(name = "order_id", length = 120)
    private String orderId;

    @Lob
    @Column(name = "response_json", columnDefinition = "TEXT")
    private String responseJson;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public OrderExecution(
            Long signalEventId,
            String signalId,
            Long userId,
            Long groupId,
            Long strategyGroupItemId,
            String strategyCode,
            String symbol,
            String intervalValue,
            String signal,
            String side,
            Double requestQty,
            Double executedQty,
            Double remainingQty,
            String orderType,
            Double requestPrice,
            Double requestTakeProfit,
            Double requestStopLoss,
            OrderExecutionStatus status,
            Integer retCode,
            String retMsg,
            String orderId,
            String responseJson,
            String errorMessage
    ) {
        this.signalEventId = signalEventId;
        this.signalId = signalId;
        this.userId = userId;
        this.groupId = groupId;
        this.strategyGroupItemId = strategyGroupItemId;
        this.strategyCode = strategyCode;
        this.symbol = symbol;
        this.intervalValue = intervalValue;
        this.signal = signal;
        this.side = side;
        this.requestQty = requestQty;
        this.executedQty = executedQty;
        this.remainingQty = remainingQty;
        this.orderType = orderType;
        this.requestPrice = requestPrice;
        this.requestTakeProfit = requestTakeProfit;
        this.requestStopLoss = requestStopLoss;
        this.status = status;
        this.retCode = retCode;
        this.retMsg = retMsg;
        this.orderId = orderId;
        this.responseJson = responseJson;
        this.errorMessage = errorMessage;
    }

    public void updateFillStatus(OrderExecutionStatus status, Double executedQty, Double remainingQty, String responseJson) {
        this.status = status;
        this.executedQty = executedQty;
        this.remainingQty = remainingQty;
        if (responseJson != null) {
            this.responseJson = responseJson;
        }
    }
}
