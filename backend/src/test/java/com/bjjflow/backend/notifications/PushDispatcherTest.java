package com.bjjflow.backend.notifications;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class PushDispatcherTest {

    @Test
    void deliversToExpoAndRemovesStaleTokens() {
        PushTokenRepository repository = mock(PushTokenRepository.class);
        when(repository.findAllByUserId(1L)).thenReturn(List.of(
                token(1L, "ExponentPushToken[alive]"),
                token(1L, "ExponentPushToken[stale]"),
                token(1L, "raw-apns-token-ignored")));

        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://exp.host/--/api/v2/push/send"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"data": [
                          {"status": "ok"},
                          {"status": "error", "message": "device gone",
                           "details": {"error": "DeviceNotRegistered"}}
                        ]}
                        """, MediaType.APPLICATION_JSON));

        PushDispatcher dispatcher = new PushDispatcher(repository, builder, true);
        dispatcher.sendToUser(1L, "Título", "Corpo");

        // Delivery is async; the stale-token cleanup proves the round trip happened.
        verify(repository, timeout(5000)).deleteByToken("ExponentPushToken[stale]");
        server.verify();
    }

    @Test
    void disabledDispatcherDoesNothing() {
        PushTokenRepository repository = mock(PushTokenRepository.class);
        PushDispatcher dispatcher = new PushDispatcher(repository, RestClient.builder(), false);
        dispatcher.sendToUser(1L, "Título", "Corpo");
        verifyNoInteractions(repository);
    }

    @Test
    void usersWithoutExpoTokensTriggerNoCall() {
        PushTokenRepository repository = mock(PushTokenRepository.class);
        when(repository.findAllByUserId(anyLong())).thenReturn(List.of(token(2L, "raw-token")));
        // No MockRestServiceServer expectation: any HTTP call would throw.
        PushDispatcher dispatcher = new PushDispatcher(repository, RestClient.builder(), true);
        dispatcher.sendToUser(2L, "Título", "Corpo");
        verify(repository).findAllByUserId(2L);
    }

    private static PushToken token(Long userId, String value) {
        PushToken pushToken = new PushToken();
        pushToken.setUserId(userId);
        pushToken.setToken(value);
        return pushToken;
    }
}
