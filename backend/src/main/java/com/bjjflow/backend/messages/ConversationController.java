package com.bjjflow.backend.messages;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.messages.MessageDtos.ConversationDto;
import com.bjjflow.backend.messages.MessageDtos.MessageDto;
import com.bjjflow.backend.messages.MessageDtos.SendMessageRequest;
import com.bjjflow.backend.messages.MessageDtos.StartConversationRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping
    public List<ConversationDto> inbox(Authentication auth) {
        return conversationService.inbox(userId(auth));
    }

    /** Get-or-create a 1:1 conversation with another user. */
    @PostMapping
    public ConversationDto start(Authentication auth, @RequestBody StartConversationRequest request) {
        return conversationService.start(userId(auth), request.userId());
    }

    /**
     * Messages in chronological order. {@code after} returns only newer messages
     * (polling), {@code before} the previous page, neither the latest {@code limit}.
     */
    @GetMapping("/{id}/messages")
    public List<MessageDto> messages(Authentication auth, @PathVariable Long id,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Long before,
            @RequestParam(required = false) Long after) {
        return conversationService.messages(userId(auth), id, limit, before, after);
    }

    @PostMapping("/{id}/messages")
    public MessageDto send(Authentication auth, @PathVariable Long id, @Valid @RequestBody SendMessageRequest request) {
        Long me = userId(auth);
        try {
            return conversationService.send(me, id, request.content(), request.clientId());
        } catch (org.springframework.dao.DataIntegrityViolationException duplicate) {
            // Two copies of the same message raced; the other one won. Return it.
            return conversationService.findByClientId(me, id, request.clientId()).orElseThrow(() -> duplicate);
        }
    }
}
