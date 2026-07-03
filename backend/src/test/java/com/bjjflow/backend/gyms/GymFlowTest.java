package com.bjjflow.backend.gyms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class GymFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email, String beltSlug) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "email": "%s",
                          "password": "senha-forte-123",
                          "displayName": "%s",
                          "age": 30,
                          "beltSlug": "%s",
                          "stripes": 1
                        }
                        """.formatted(email, email.split("@")[0], beltSlug)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    @Test
    void createJoinAndListMembers() throws Exception {
        String owner = register("dono@bjjflow.com", "adult-black");

        // create gym -> creator becomes OWNER with an invite code
        var created = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Minha Academia", "city": "São Paulo", "description": "Test"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.memberCount").value(1))
                .andExpect(jsonPath("$.graduationTarget").value(40))
                .andExpect(jsonPath("$.inviteCode").isNotEmpty())
                .andReturn();
        String code = JsonPath.read(created.getResponse().getContentAsString(), "$.inviteCode");

        // owner already has a gym -> cannot create another
        mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Outra"}
                        """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_IN_GYM"));

        // a second user with no gym
        String student = register("aluno@bjjflow.com", "adult-blue");
        mockMvc.perform(get("/api/v1/gyms/me").header("Authorization", "Bearer " + student))
                .andExpect(status().isNoContent());

        // wrong code rejected
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", "Bearer " + student)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"inviteCode": "WRONGCODE"}
                        """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVALID_INVITE_CODE"));

        // join with the real code (lowercase to prove normalization) -> MEMBER, no invite code returned
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", "Bearer " + student)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"inviteCode": "%s"}
                        """.formatted(code.toLowerCase())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.memberCount").value(2))
                .andExpect(jsonPath("$.inviteCode").doesNotExist());

        // members list: owner first, both with belts
        mockMvc.perform(get("/api/v1/gyms/me/members").header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].role").value("OWNER"))
                .andExpect(jsonPath("$[0].belt.namePt").value("Preta"))
                .andExpect(jsonPath("$[1].role").value("MEMBER"))
                .andExpect(jsonPath("$[1].belt.slug").value("adult-blue"));

        // student already in a gym -> no more suggestions; a fresh user still gets some
        mockMvc.perform(get("/api/v1/gyms/suggestions").header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        String newcomer = register("novato@bjjflow.com", "adult-white");
        mockMvc.perform(get("/api/v1/gyms/suggestions").header("Authorization", "Bearer " + newcomer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").isNotEmpty());
    }

    @Test
    void roleSwitchAndLeave() throws Exception {
        String user = register("troca@bjjflow.com", "adult-purple");

        mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", "Bearer " + user)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Academia Troca"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"));

        // flip to MEMBER -> invite code hidden
        mockMvc.perform(post("/api/v1/gyms/me/role")
                .header("Authorization", "Bearer " + user)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"role": "MEMBER"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.inviteCode").doesNotExist());

        // flip to INSTRUCTOR -> invite code visible again
        mockMvc.perform(post("/api/v1/gyms/me/role")
                .header("Authorization", "Bearer " + user)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"role": "INSTRUCTOR"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("INSTRUCTOR"))
                .andExpect(jsonPath("$.inviteCode").isNotEmpty());

        // invalid role rejected
        mockMvc.perform(post("/api/v1/gyms/me/role")
                .header("Authorization", "Bearer " + user)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"role": "KING"}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ROLE"));

        // leave -> no longer in a gym
        mockMvc.perform(post("/api/v1/gyms/leave").header("Authorization", "Bearer " + user))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/gyms/me").header("Authorization", "Bearer " + user))
                .andExpect(status().isNoContent());
    }
}
