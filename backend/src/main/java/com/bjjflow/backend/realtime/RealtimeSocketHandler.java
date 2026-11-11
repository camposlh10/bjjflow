package com.bjjflow.backend.realtime;

import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.bjjflow.backend.auth.JwtService;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The realtime socket at {@code /api/v1/realtime}. Protocol (JSON text frames):
 * <ul>
 * <li>client → {@code {"type":"auth","token":"<access token>"}} first, within 10s;
 * server → {@code {"type":"ready"}}, or closes with 4001 if the token is bad;</li>
 * <li>client → {@code {"type":"ping"}}, server → {@code {"type":"pong"}};</li>
 * <li>server → events such as {@code {"type":"message","conversationId":..}} and
 * {@code {"type":"notification",..}}.</li>
 * </ul>
 * The token travels in the first frame rather than the URL so it never ends up
 * in proxy or access logs (browsers cannot set headers on a WebSocket).
 */
@Component
public class RealtimeSocketHandler extends TextWebSocketHandler {

    private final RealtimeHub hub;
    private final JwtService jwtService;
    private final JsonMapper json;

    public RealtimeSocketHandler(RealtimeHub hub, JwtService jwtService, JsonMapper json) {
        this.hub = hub;
        this.jwtService = jwtService;
        this.json = json;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        hub.opened(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Map<String, Object> frame;
        try {
            frame = json.readValue(message.getPayload(), new TypeReference<Map<String, Object>>() {
            });
        } catch (RuntimeException malformed) {
            RealtimeHub.close(session, CloseStatus.BAD_DATA);
            return;
        }
        Object type = frame.get("type");
        if ("auth".equals(type)) {
            Object token = frame.get("token");
            var parsed = token == null ? java.util.Optional.<JwtService.ParsedToken>empty()
                    : jwtService.parse(token.toString()).filter(t -> "access".equals(t.type()));
            if (parsed.isEmpty()) {
                RealtimeHub.close(session, RealtimeHub.TOKEN_EXPIRED);
                return;
            }
            hub.authenticated(session, parsed.get().userId(), parsed.get().expiresAt());
        } else if ("ping".equals(type)) {
            hub.reply(session, Map.of("type", "pong"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        hub.closed(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        hub.closed(session);
    }
}
