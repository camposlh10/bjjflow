package com.bjjflow.backend.messages;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.messages.MessageDtos.ConversationDto;
import com.bjjflow.backend.messages.MessageDtos.MessageDto;
import com.bjjflow.backend.messages.MessageDtos.ParticipantDto;
import com.bjjflow.backend.storage.MediaStorage;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final int INBOX_LIMIT = 200;
    /** Requests without a limit (older app builds) get the most recent messages only. */
    private static final int LEGACY_PAGE = 200;
    private static final int MAX_PAGE = 200;

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final MediaStorage mediaStorage;
    private final NotificationService notificationService;
    private final com.bjjflow.backend.realtime.RealtimeHub realtimeHub;

    /** Fixed number of queries regardless of how many conversations there are. */
    @Transactional(readOnly = true)
    public List<ConversationDto> inbox(Long me) {
        List<Conversation> convs = conversationRepository.inbox(me, PageRequest.of(0, INBOX_LIMIT));
        if (convs.isEmpty()) {
            return List.of();
        }
        Map<Long, User> users = userRepository.findAllById(convs.stream().map(c -> otherId(c, me)).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<Long, Long> unread = new HashMap<>();
        for (Object[] row : messageRepository.unreadCounts(me, Instant.EPOCH)) {
            unread.put((Long) row[0], (Long) row[1]);
        }
        return convs.stream()
                .map(c -> toDto(c, me, users.get(otherId(c, me)), unread.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public ConversationDto start(Long me, Long otherUserId) {
        if (otherUserId == null || otherUserId.equals(me)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RECIPIENT", "Cannot message yourself");
        }
        User other = userRepository.findById(otherUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        Long a = Math.min(me, otherUserId);
        Long b = Math.max(me, otherUserId);
        Conversation conv = conversationRepository.findByUserAIdAndUserBId(a, b)
                .orElseGet(() -> {
                    Conversation c = new Conversation();
                    c.setUserAId(a);
                    c.setUserBId(b);
                    return conversationRepository.save(c);
                });
        return toDto(conv, me, other);
    }

    /**
     * A slice of the thread, always in chronological order:
     * <ul>
     * <li>{@code afterId} set: only messages newer than it (what a poll needs);</li>
     * <li>{@code beforeId} set: the page of older messages just before it;</li>
     * <li>neither: the latest {@code limit} messages.</li>
     * </ul>
     * Reading the thread marks it read for the caller.
     */
    @Transactional
    public List<MessageDto> messages(Long me, Long conversationId, Integer limit, Long beforeId, Long afterId) {
        Conversation conv = requireMember(me, conversationId);
        int size = limit == null ? LEGACY_PAGE : Math.min(Math.max(limit, 1), MAX_PAGE);
        List<Message> page;
        if (afterId != null) {
            page = messageRepository.findByConversationIdAndIdGreaterThanOrderByIdAsc(conversationId, afterId,
                    PageRequest.of(0, size));
        } else {
            List<Message> newestFirst = beforeId != null
                    ? messageRepository.findByConversationIdAndIdLessThanOrderByIdDesc(conversationId, beforeId,
                            PageRequest.of(0, size))
                    : messageRepository.findByConversationIdOrderByIdDesc(conversationId, PageRequest.of(0, size));
            page = new ArrayList<>(newestFirst);
            Collections.reverse(page);
        }
        // An empty poll changes nothing, so it must not cost a write every few seconds.
        boolean nothingNew = afterId != null && page.isEmpty();
        if (!nothingNew && beforeId == null) {
            if (conv.getUserAId().equals(me)) {
                conv.setUserALastReadAt(Instant.now());
            } else {
                conv.setUserBLastReadAt(Instant.now());
            }
            conversationRepository.save(conv);
        }
        return page.stream()
                .map(m -> new MessageDto(m.getId(), m.getSenderId(), m.getSenderId().equals(me), m.getContent(),
                        m.getCreatedAt()))
                .toList();
    }

    @Transactional
    public MessageDto send(Long me, Long conversationId, String content) {
        return send(me, conversationId, content, null);
    }

    @Transactional
    public MessageDto send(Long me, Long conversationId, String content, String clientId) {
        Conversation conv = requireMember(me, conversationId);
        String key = clientId == null || clientId.isBlank() ? null : clientId.trim();
        if (key != null) {
            // A retry of a message that already went through: answer the same way.
            var existing = messageRepository.findBySenderIdAndClientId(me, key);
            if (existing.isPresent() && existing.get().getConversationId().equals(conversationId)) {
                return toMessageDto(existing.get(), me);
            }
        }
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(me);
        msg.setContent(content.trim());
        msg.setClientId(key);
        msg = messageRepository.save(msg);
        conv.setLastMessageAt(msg.getCreatedAt());
        conv.setLastMessagePreview(msg.getContent());
        conv.setLastSenderId(me);
        // The sender has implicitly read up to their own message.
        if (conv.getUserAId().equals(me)) {
            conv.setUserALastReadAt(msg.getCreatedAt());
        } else {
            conv.setUserBLastReadAt(msg.getCreatedAt());
        }
        conversationRepository.save(conv);

        // Notify the recipient (respects their notify_messages preference).
        Long recipient = conv.getUserAId().equals(me) ? conv.getUserBId() : conv.getUserAId();
        String senderName = userRepository.findById(me).map(User::getDisplayName).orElse("Alguém");
        notificationService.notify(recipient, NotificationType.MESSAGE, senderName, preview(msg.getContent()),
                "conversation:" + conversationId);

        // Live update for the recipient's open app, and for the sender's other devices.
        Map<String, Object> event = Map.of("type", "message", "conversationId", conversationId,
                "messageId", msg.getId());
        realtimeHub.publishAfterCommit(recipient, event);
        realtimeHub.publishAfterCommit(me, event);

        // If the other participant is the test bot, it auto-replies so DMs are testable solo.
        maybeBotReply(conv, me);
        return toMessageDto(msg, me);
    }

    /** The message a concurrent duplicate request already created (see ConversationController). */
    @Transactional(readOnly = true)
    public java.util.Optional<MessageDto> findByClientId(Long me, Long conversationId, String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return java.util.Optional.empty();
        }
        return messageRepository.findBySenderIdAndClientId(me, clientId.trim())
                .filter(m -> m.getConversationId().equals(conversationId))
                .map(m -> toMessageDto(m, me));
    }

    private static MessageDto toMessageDto(Message m, Long me) {
        return new MessageDto(m.getId(), m.getSenderId(), m.getSenderId().equals(me), m.getContent(),
                m.getCreatedAt());
    }

    private void maybeBotReply(Conversation conv, Long sender) {
        Long otherId = conv.getUserAId().equals(sender) ? conv.getUserBId() : conv.getUserAId();
        userRepository.findById(otherId)
                .filter(u -> Boolean.TRUE.equals(u.getBot()))
                .ifPresent(bot -> {
                    Message reply = new Message();
                    reply.setConversationId(conv.getId());
                    reply.setSenderId(bot.getId());
                    reply.setContent(botReply());
                    reply = messageRepository.save(reply);
                    conv.setLastMessageAt(reply.getCreatedAt());
                    conv.setLastMessagePreview(reply.getContent());
                    conv.setLastSenderId(bot.getId());
                    if (conv.getUserAId().equals(bot.getId())) {
                        conv.setUserALastReadAt(reply.getCreatedAt());
                    } else {
                        conv.setUserBLastReadAt(reply.getCreatedAt());
                    }
                    conversationRepository.save(conv);
                    realtimeHub.publishAfterCommit(sender, Map.of("type", "message",
                            "conversationId", conv.getId(), "messageId", reply.getId()));
                });
    }

    private static final String[] BOT_REPLIES = {
            "Oss! 🤖 Recebi sua mensagem. Bora treinar!",
            "Fechou! Te vejo no tatame 🥋",
            "Boa! Continua firme nos treinos 💪",
            "Salve! Qualquer dúvida sobre BJJ, manda aí.",
    };

    private String botReply() {
        return BOT_REPLIES[(int) (Math.random() * BOT_REPLIES.length)];
    }

    private Conversation requireMember(Long me, Long conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND", "Not found"));
        if (!conv.getUserAId().equals(me) && !conv.getUserBId().equals(me)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND", "Not found");
        }
        return conv;
    }

    private Long otherId(Conversation c, Long me) {
        return c.getUserAId().equals(me) ? c.getUserBId() : c.getUserAId();
    }

    private static String preview(String content) {
        return content.length() <= 120 ? content : content.substring(0, 117) + "...";
    }

    /** Single conversation (get-or-create): one count query is fine here. */
    private ConversationDto toDto(Conversation c, Long me, User other) {
        Instant myLastRead = c.getUserAId().equals(me) ? c.getUserALastReadAt() : c.getUserBLastReadAt();
        long unread = myLastRead == null
                ? messageRepository.countByConversationIdAndSenderIdNot(c.getId(), me)
                : messageRepository.countByConversationIdAndSenderIdNotAndCreatedAtAfter(c.getId(), me, myLastRead);
        return toDto(c, me, other, unread);
    }

    private ConversationDto toDto(Conversation c, Long me, User other, long unread) {
        ParticipantDto participant = other == null
                ? new ParticipantDto(otherId(c, me), null, "—", false, null)
                : new ParticipantDto(other.getId(), other.getUsername(), other.getDisplayName(),
                        Boolean.TRUE.equals(other.getPro()),
                        other.getAvatarKey() == null ? null : mediaStorage.urlFor(other.getAvatarKey()));
        return new ConversationDto(
                c.getId(),
                participant,
                c.getLastMessagePreview(),
                me.equals(c.getLastSenderId()),
                c.getLastMessageAt(),
                unread);
    }
}
