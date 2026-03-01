package corque.backend.order.infra;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class BybitOrderClient {

    private static final String HMAC_SHA256 = "HmacSHA256";

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${trading.bybit.base-url:https://api-testnet.bybit.com}")
    private String bybitBaseUrl;

    @Value("${trading.bybit.category:linear}")
    private String category;

    @Value("${trading.bybit.api-key:}")
    private String apiKey;

    @Value("${trading.bybit.api-secret:}")
    private String apiSecret;

    @Value("${trading.bybit.recv-window:5000}")
    private String recvWindow;

    public BybitOrderResult placeOrder(
            String symbol,
            String side,
            double qty,
            Double price,
            Double takeProfit,
            Double stopLoss
    ) {
        if (apiKey == null || apiKey.isBlank() || apiSecret == null || apiSecret.isBlank()) {
            throw new IllegalStateException("Bybit API credentials are not configured.");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("category", category);
        payload.put("symbol", symbol);
        payload.put("side", side);
        payload.put("qty", String.valueOf(qty));
        if (price != null && price > 0) {
            payload.put("orderType", "Limit");
            payload.put("price", String.valueOf(price));
            payload.put("timeInForce", "GTC");
        } else {
            payload.put("orderType", "Market");
            payload.put("timeInForce", "IOC");
        }
        if (takeProfit != null && takeProfit > 0) {
            payload.put("takeProfit", String.valueOf(takeProfit));
        }
        if (stopLoss != null && stopLoss > 0) {
            payload.put("stopLoss", String.valueOf(stopLoss));
        }

        String body;
        try {
            body = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Bybit order body serialize failed", e);
        }

        String timestamp = String.valueOf(System.currentTimeMillis());
        String signPayload = timestamp + apiKey + recvWindow + body;
        String sign = hmacSha256Hex(apiSecret, signPayload);

        RestClient restClient = restClientBuilder.baseUrl(bybitBaseUrl).build();
        return restClient.post()
                .uri("/v5/order/create")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-BAPI-API-KEY", apiKey)
                .header("X-BAPI-TIMESTAMP", timestamp)
                .header("X-BAPI-RECV-WINDOW", recvWindow)
                .header("X-BAPI-SIGN", sign)
                .body(payload)
                .retrieve()
                .body(BybitOrderResult.class);
    }

    public BybitOrderResult placeMarketOrder(String symbol, String side, double qty) {
        return placeOrder(symbol, side, qty, null, null, null);
    }

    private String hmacSha256Hex(String secret, String payload) {
        try {
            Mac sha256Hmac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            sha256Hmac.init(secretKey);
            byte[] hash = sha256Hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Bybit sign generation failed", e);
        }
    }
}
