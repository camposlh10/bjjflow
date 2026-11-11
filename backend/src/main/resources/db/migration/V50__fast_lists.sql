-- Inbox: keep the latest message on the conversation row, so listing the inbox
-- no longer runs a "last message" query per conversation.
ALTER TABLE conversations ADD COLUMN last_message_preview VARCHAR(2000);
ALTER TABLE conversations ADD COLUMN last_sender_id BIGINT;

UPDATE conversations
SET last_message_preview = (SELECT m.content
                            FROM messages m
                            WHERE m.conversation_id = conversations.id
                            ORDER BY m.id DESC
                            FETCH FIRST 1 ROW ONLY),
    last_sender_id       = (SELECT m.sender_id
                            FROM messages m
                            WHERE m.conversation_id = conversations.id
                            ORDER BY m.id DESC
                            FETCH FIRST 1 ROW ONLY);

-- Message paging and "only what is new since id X" polling walk a thread by id.
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id, id);

-- Gym wall pages newest-first by id within a gym.
CREATE INDEX idx_gym_posts_gym_id ON gym_posts (gym_id, id);

-- Comment threads are read newest-first by id and capped.
CREATE INDEX idx_gym_post_comments_post_id ON gym_post_comments (post_id, id);
CREATE INDEX idx_check_in_comments_checkin_id ON check_in_comments (check_in_id, id);
