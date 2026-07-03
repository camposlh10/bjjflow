package com.bjjflow.backend.posts;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class PostFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email, String beltSlug) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "%s", "stripes": 1}
                        """.formatted(email, email.split("@")[0], beltSlug)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String createGymGetCode(String token) throws Exception {
        return JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Academia Mural", "city": "São Paulo"}
                        """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.inviteCode");
    }

    private long createPost(String token, String content) throws Exception {
        var res = mockMvc.perform(post("/api/v1/gyms/posts")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"%s\"}".formatted(content)))
                .andExpect(status().isOk())
                .andReturn();
        return ((Number) JsonPath.read(res.getResponse().getContentAsString(), "$.id")).longValue();
    }

    @Test
    void anyMemberPostsAndInteracts() throws Exception {
        String owner = register("prof@bjjflow.com", "adult-black");
        String code = createGymGetCode(owner);
        String student = register("aluno@bjjflow.com", "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());

        long p1 = createPost(owner, "Treino forte hoje!");
        long p2 = createPost(owner, "Aviso: sem aula sexta");

        // students CAN post now
        var p3res = mockMvc.perform(post("/api/v1/gyms/posts")
                .header("Authorization", bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content": "Tô empolgado pro treino!"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.author.role").value("MEMBER"))
                .andExpect(jsonPath("$.author.belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$.media.length()").value(0))
                .andReturn();
        long p3 = ((Number) JsonPath.read(p3res.getResponse().getContentAsString(), "$.id")).longValue();

        // pin p2 (staff only)
        mockMvc.perform(put("/api/v1/gyms/posts/" + p2 + "/pin")
                .header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"pinned": true}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinned").value(true));

        // feed: 3 posts, pinned first
        mockMvc.perform(get("/api/v1/gyms/posts").header("Authorization", bearer(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value((int) p2));

        // like toggle on p1
        mockMvc.perform(post("/api/v1/gyms/posts/" + p1 + "/like").header("Authorization", bearer(student)))
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likeCount").value(1));
        mockMvc.perform(post("/api/v1/gyms/posts/" + p1 + "/like").header("Authorization", bearer(student)))
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likeCount").value(0));

        // comment + share
        mockMvc.perform(post("/api/v1/gyms/posts/" + p1 + "/comments")
                .header("Authorization", bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content": "Oss!"}
                        """))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/gyms/posts/" + p1 + "/share").header("Authorization", bearer(student)))
                .andExpect(jsonPath("$.shareCount").value(1));

        // students still can't pin
        mockMvc.perform(put("/api/v1/gyms/posts/" + p1 + "/pin")
                .header("Authorization", bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"pinned": true}
                        """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_STAFF"));

        // can't delete someone else's; can delete own
        mockMvc.perform(delete("/api/v1/gyms/posts/" + p1).header("Authorization", bearer(student)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ALLOWED"));
        mockMvc.perform(delete("/api/v1/gyms/posts/" + p3).header("Authorization", bearer(student)))
                .andExpect(status().isOk());

        // owner can delete anyone's
        mockMvc.perform(delete("/api/v1/gyms/posts/" + p1).header("Authorization", bearer(owner)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/gyms/posts").header("Authorization", bearer(student)))
                .andExpect(jsonPath("$.length()").value(1));

        // empty post rejected
        mockMvc.perform(post("/api/v1/gyms/posts")
                .header("Authorization", bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content": "   "}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMPTY_POST"));
    }

    @Test
    void uploadMediaAndPostWithIt() throws Exception {
        String owner = register("midia@bjjflow.com", "adult-purple");
        createGymGetCode(owner);

        MockMultipartFile image = new MockMultipartFile("file", "treino.jpg", "image/jpeg",
                new byte[] { 1, 2, 3, 4, 5 });
        var upload = mockMvc.perform(multipart("/api/v1/gyms/posts/media")
                .file(image)
                .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("IMAGE"))
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("/media/")))
                .andReturn();
        String key = JsonPath.read(upload.getResponse().getContentAsString(), "$.key");

        mockMvc.perform(post("/api/v1/gyms/posts")
                .header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"foto do treino\", \"media\": [{\"key\": \"%s\", \"type\": \"IMAGE\"}]}"
                        .formatted(key)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.media.length()").value(1))
                .andExpect(jsonPath("$.media[0].type").value("IMAGE"))
                .andExpect(jsonPath("$.media[0].url").value(org.hamcrest.Matchers.startsWith("/media/")));

        // non-image/video rejected
        MockMultipartFile text = new MockMultipartFile("file", "notes.txt", "text/plain",
                new byte[] { 9, 9 });
        mockMvc.perform(multipart("/api/v1/gyms/posts/media")
                .file(text)
                .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA"));
    }

    @Test
    void saveAndListSavedPosts() throws Exception {
        String user = register("salvar@bjjflow.com", "adult-blue");
        createGymGetCode(user);
        long p1 = createPost(user, "Post para salvar");

        // save -> savedByMe true and appears in /saved
        mockMvc.perform(post("/api/v1/gyms/posts/" + p1 + "/save").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(true));
        mockMvc.perform(get("/api/v1/gyms/posts/" + p1).header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.savedByMe").value(true));
        mockMvc.perform(get("/api/v1/gyms/posts/saved").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value((int) p1));

        // unsave -> gone from /saved
        mockMvc.perform(post("/api/v1/gyms/posts/" + p1 + "/save").header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.saved").value(false));
        mockMvc.perform(get("/api/v1/gyms/posts/saved").header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
