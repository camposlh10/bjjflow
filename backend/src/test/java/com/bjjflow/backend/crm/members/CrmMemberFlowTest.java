package com.bjjflow.backend.crm.members;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import com.bjjflow.backend.crm.security.CrmAccessService;
import com.bjjflow.backend.crm.security.CrmPrincipal;
import com.bjjflow.backend.gyms.GymRole;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class CrmMemberFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CrmAccessService crmAccessService;

    @Test
    void staffCanListViewAndUpdateMembers() throws Exception {
        Account owner = register("member-crm-owner@bjjflow.com", "CRM Owner", "adult-black");
        String gymJson = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Member CRM Academy\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String inviteCode = JsonPath.read(gymJson, "$.inviteCode");

        CrmPrincipal ownerPrincipal = crmAccessService.requireStaff(owner.userId());
        assertEquals(owner.userId(), ownerPrincipal.userId());
        assertEquals(GymRole.OWNER, ownerPrincipal.role());
        assertTrue(ownerPrincipal.isOwner());
        assertTrue(ownerPrincipal.isStaff());

        Account student = register("member-crm-student@bjjflow.com", "CRM Student", "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(student.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(inviteCode)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/crm/members")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[?(@.userId == %d)].displayName".formatted(student.userId()))
                        .value("CRM Student"))
                .andExpect(jsonPath("$[?(@.userId == %d)].role".formatted(student.userId()))
                        .value("MEMBER"));

        mockMvc.perform(get("/api/v1/crm/members/" + student.userId())
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("member-crm-student@bjjflow.com"))
                .andExpect(jsonPath("$.belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$.totalClasses").value(0));

        mockMvc.perform(get("/api/v1/crm/members")
                .header("Authorization", bearer(student.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));

        mockMvc.perform(put("/api/v1/crm/members/" + student.userId())
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\": \"INSTRUCTOR\", \"beltSlug\": \"adult-purple\", \"stripes\": 1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("INSTRUCTOR"))
                .andExpect(jsonPath("$.belt.slug").value("adult-purple"))
                .andExpect(jsonPath("$.belt.stripes").value(1));

        mockMvc.perform(get("/api/v1/crm/members")
                .header("Authorization", bearer(student.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        CrmPrincipal instructorPrincipal = crmAccessService.requireStaff(student.userId());
        assertEquals(GymRole.INSTRUCTOR, instructorPrincipal.role());
        assertFalse(instructorPrincipal.isOwner());
        assertTrue(instructorPrincipal.isStaff());

        mockMvc.perform(put("/api/v1/crm/members/" + owner.userId())
                .header("Authorization", bearer(student.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\": \"MEMBER\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_OWNER_ONLY"));
    }

    private Account register(String email, String displayName, String beltSlug) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, displayName, beltSlug)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new Account(
                JsonPath.read(response, "$.accessToken"),
                ((Number) JsonPath.read(response, "$.user.id")).longValue());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private record Account(String token, long userId) {
    }
}
