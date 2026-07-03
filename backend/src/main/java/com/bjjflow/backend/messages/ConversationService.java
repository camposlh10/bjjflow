package com.bjjflow.backend.messages;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

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

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final MediaStorage mediaStorage;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<ConversationDto> inbox(Long me) {
        List<Conversation> convs = conversationRepository.findByUserAIdOrUserBIdOrderByLastMessageAtDesc(me, me);
        if (convs.isEmpty()) {
            return List.of();
        }
        Map<Long, User> users = userRepository.findAllById(convs.stream().map(c -> otherId(c, me)).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return convs.stream()
                .filter(c -> c.getLastMessageAt() != null) // hide empty get-or-created shells from the inbox
                .map(c -> toDto(c, me, users.get(otherId(c, me))))
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

    @Transactional
    public List<MessageDto> messages(Long me, Long conversationId) {
        Conversation conv = requireMember(me, conversationId);
        // Opening the thread marks it read for me.
        if (conv.getUserAId().equals(me)) {
            conv.setUserALastReadAt(Instant.now());
        } else {
            conv.setUserBLastReadAt(Instant.now());
        }
        conversationRepository.save(conv);
        return messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conversationId).stream()
                .map(m -> new MessageDto(m.getId(), m.getSenderId(), m.getSenderId().equals(me), m.getContent(),
                        m.getCreatedAt()))
                .toList();
    }

    @Transactional
    public MessageDto send(Long me, Long conversationId, String content) {
        Conversation conv = requireMember(me, conversationId);
        Message msg = new Message();
        msg.setConversationId(conversationId);
        msg.setSenderId(me);
        msg.setContent(content.trim());
        msg = messageRepository.save(msg);
        conv.setLastMessageAt(msg.getCreatedAt());
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

        // If the other participant is the test bot, it auto-replies so DMs are testable solo.
        maybeBotReply(conv, me);
        return new MessageDto(msg.getId(), me, true, msg.getContent(), msg.getCreatedAt());
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
                    if (conv.getUserAId().equals(bot.getId())) {
                        conv.setUserALastReadAt(reply.getCreatedAt());
                    } else {
                        conv.setUserBLastReadAt(reply.getCreatedAt());
                    }
                    conversationRepository.save(conv);
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

    private ConversationDto toDto(Conversation c, Long me, User other) {
        Instant myLastRead = c.getUserAId().equals(me) ? c.getUserALastReadAt() : c.getUserBLastReadAt();
        long unread = myLastRead == null
                ? messageRepository.countByConversationIdAndSenderIdNot(c.getId(), me)
                : messageRepository.countByConversationIdAndSenderIdNotAndCreatedAtAfter(c.getId(), me, myLastRead);
        Message last = messageRepository.findTopByConversationIdOrderByCreatedAtDesc(c.getId());
        ParticipantDto participant = other == null
                ? new ParticipantDto(otherId(c, me), null, "—", false, null)
                : new ParticipantDto(other.getId(), other.getUsername(), other.getDisplayName(),
                        Boolean.TRUE.equals(other.getPro()),
                        other.getAvatarKey() == null ? null : mediaStorage.urlFor(other.getAvatarKey()));
        return new ConversationDto(
                c.getId(),
                participant,
                last == null ? null : last.getContent(),
                last != null && last.getSenderId().equals(me),
                c.getLastMessageAt(),
                unread);
    }
}
