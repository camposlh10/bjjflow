package com.bjjflow.backend.messages;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @GetMapping("/{id}/messages")
    public List<MessageDto> messages(Authentication auth, @PathVariable Long id) {
        return conversationService.messages(userId(auth), id);
    }

    @PostMapping("/{id}/messages")
    public MessageDto send(Authentication auth, @PathVariable Long id, @Valid @RequestBody SendMessageRequest request) {
        return conversationService.send(userId(auth), id, request.content());
    }
}
