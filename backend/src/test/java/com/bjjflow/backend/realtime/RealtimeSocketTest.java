package com.bjjflow.backend.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** The live channel over a real socket: auth handshake, then message/notification events. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RealtimeSocketTest {

    @LocalServerPort
    private int port;

    private RestClient api() {
        return RestClient.builder().baseUrl("http://localhost:" + port + "/api/v1").build();
    }

    /** Returns {accessToken, userId}. Emails are unique: this test commits real rows. */
    @SuppressWarnings("unchecked")
    private String[] register(String prefix) {
        String email = prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@bjjflow.com";
        Map<String, Object> body = api().post().uri("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", "senha-forte-123", "displayName", prefix,
                        "age", 30, "beltSlug", "adult-blue", "stripes", 0))
                .retrieve().body(Map.class);
        Map<String, Object> user = (Map<String, Object>) body.get("user");
        return new String[] { (String) body.get("accessToken"), String.valueOf(user.get("id")) };
    }

    private static final class Recorder extends TextWebSocketHandler {
        final BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        final CompletableFuture<CloseStatus> closed = new CompletableFuture<>();

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            frames.add(message.getPayload());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            closed.complete(status);
        }
    }

    private WebSocketSession connect(Recorder recorder) throws Exception {
        return new StandardWebSocketClient()
                .execute(recorder, "ws://localhost:" + port + "/api/v1/realtime")
                .get(5, TimeUnit.SECONDS);
    }

    private String next(Recorder recorder) throws InterruptedException {
        String frame = recorder.frames.poll(5, TimeUnit.SECONDS);
        assertThat(frame).as("expected a frame within 5s").isNotNull();
        return frame;
    }

    @Test
    void authenticatedClientReceivesMessageAndNotificationEvents() throws Exception {
        String[] sender = register("rt-sender");
        String[] receiver = register("rt-receiver");

        Recorder recorder = new Recorder();
        WebSocketSession socket = connect(recorder);
        socket.sendMessage(new TextMessage("{\"type\":\"auth\",\"token\":\"" + receiver[0] + "\"}"));
        assertThat(next(recorder)).contains("\"ready\"");

        socket.sendMessage(new TextMessage("{\"type\":\"ping\"}"));
        assertThat(next(recorder)).contains("\"pong\"");

        @SuppressWarnings("unchecked")
        Map<String, Object> conv = api().post().uri("/conversations")
                .header("Authorization", "Bearer " + sender[0]).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", Long.parseLong(receiver[1]))).retrieve().body(Map.class);
        Object convId = conv.get("id");
        api().post().uri("/conversations/" + convId + "/messages")
                .header("Authorization", "Bearer " + sender[0]).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("content", "Bora treinar?")).retrieve().toBodilessEntity();

        String first = next(recorder);
        String second = next(recorder);
        String both = first + second;
        assertThat(both).contains("\"type\":\"message\"").contains("\"conversationId\":" + convId);
        assertThat(both).contains("\"type\":\"notification\"").contains("\"notificationType\":\"MESSAGE\"");
        socket.close();
    }

    @Test
    void anInvalidTokenIsRejected() throws Exception {
        Recorder recorder = new Recorder();
        WebSocketSession socket = connect(recorder);
        socket.sendMessage(new TextMessage("{\"type\":\"auth\",\"token\":\"not-a-token\"}"));
        CloseStatus status = recorder.closed.get(5, TimeUnit.SECONDS);
        assertThat(status.getCode()).isEqualTo(4001);
    }

    @Test
    void eventsOnlyReachTheirOwnUser() throws Exception {
        String[] sender = register("rt-a");
        String[] receiver = register("rt-b");
        String[] bystander = register("rt-c");

        Recorder recorder = new Recorder();
        WebSocketSession socket = connect(recorder);
        socket.sendMessage(new TextMessage("{\"type\":\"auth\",\"token\":\"" + bystander[0] + "\"}"));
        assertThat(next(recorder)).contains("\"ready\"");

        @SuppressWarnings("unchecked")
        Map<String, Object> conv = api().post().uri("/conversations")
                .header("Authorization", "Bearer " + sender[0]).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", Long.parseLong(receiver[1]))).retrieve().body(Map.class);
        api().post().uri("/conversations/" + conv.get("id") + "/messages")
                .header("Authorization", "Bearer " + sender[0]).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("content", "privado")).retrieve().toBodilessEntity();

        assertThat(recorder.frames.poll(1500, TimeUnit.MILLISECONDS)).isNull();
        socket.close();
    }
}
