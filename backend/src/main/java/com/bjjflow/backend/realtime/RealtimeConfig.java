package com.bjjflow.backend.realtime;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class RealtimeConfig implements WebSocketConfigurer {

    private final RealtimeSocketHandler handler;
    private final List<String> allowedOrigins;

    public RealtimeConfig(RealtimeSocketHandler handler,
            @Value("${app.cors.allowed-origins:}") List<String> allowedOrigins) {
        this.handler = handler;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Browsers must come from an allowed origin (same list as CORS). Native
        // apps either send no Origin or the server's own, which is always allowed.
        registry.addHandler(handler, "/api/v1/realtime")
                .setAllowedOriginPatterns(allowedOrigins.stream().filter(o -> !o.isBlank()).toArray(String[]::new));
    }
}
