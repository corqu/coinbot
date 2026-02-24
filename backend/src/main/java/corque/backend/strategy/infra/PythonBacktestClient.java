package corque.backend.strategy.infra;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
public class PythonBacktestClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${trading.python-server-base-url:http://localhost:8001}")
    private String pythonServerBaseUrl;

    public PythonBacktestResponse runDynamicBacktest(PythonBacktestRequest request) {
        RestClient restClient = restClientBuilder.baseUrl(pythonServerBaseUrl).build();
        return restClient.post()
                .uri("/backtest/dynamic")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(PythonBacktestResponse.class);
    }
}

