package corque.backend.strategy.order;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class BybitOrderResult {
    private Integer retCode;
    private String retMsg;
    private Map<String, Object> result;
}

