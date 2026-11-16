package com.bjjflow.backend.kids;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class KidsProgramFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void ownerSetsUpProgramAndStaffKeepAChildsFamilyRecord() throws Exception {
        Account owner = register("kids-owner@bjjflow.com", "Kids Owner", 35);
        String inviteCode = createGym(owner, "Kids Academy");
        Account instructor = register("kids-coach@bjjflow.com", "Kids Coach", 28);
        join(instructor, inviteCode);
        mockMvc.perform(put("/api/v1/crm/members/" + instructor.userId())
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\": \"INSTRUCTOR\"}"))
                .andExpect(status().isOk());

        // Not set up yet: staff can read it, only the owner can set it up.
        mockMvc.perform(get("/api/v1/crm/kids/settings").header("Authorization", bearer(instructor.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.adultAge").value(16));
        mockMvc.perform(post("/api/v1/crm/kids/settings/recommended")
                .header("Authorization", bearer(instructor.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_OWNER_ONLY"));

        mockMvc.perform(post("/api/v1/crm/kids/settings/recommended")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.checkoutRequired").value(true))
                .andExpect(jsonPath("$.missingDocumentsPolicy").value("WARN"))
                .andExpect(jsonPath("$.ageGroups", hasSize(3)))
                .andExpect(jsonPath("$.ageGroups[1].name").value("Kids"))
                .andExpect(jsonPath("$.documentTypes", hasSize(3)))
                .andExpect(jsonPath("$.checklist.kids").value(0));

        // Applying it again keeps what is there instead of duplicating it.
        mockMvc.perform(post("/api/v1/crm/kids/settings/recommended")
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.ageGroups", hasSize(3)))
                .andExpect(jsonPath("$.documentTypes", hasSize(3)));

        // An instructor registers a child (no account of their own) with a parent.
        LocalDate birthDate = LocalDate.now().minusYears(8).minusDays(10);
        String created = mockMvc.perform(post("/api/v1/crm/kids/children")
                .header("Authorization", bearer(instructor.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"firstName": "Lia", "lastName": "Souza", "birthDate": "%s",
                         "guardian": {"name": "Ana Souza", "relationship": "MOTHER",
                                      "phone": "+55 11 99999-0000", "email": "Ana@Example.com"}}
                        """.formatted(birthDate)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Lia Souza"))
                .andExpect(jsonPath("$.managed").value(true))
                .andExpect(jsonPath("$.kid").value(true))
                .andExpect(jsonPath("$.age").value(8))
                .andExpect(jsonPath("$.ageGroup").value("Kids"))
                .andExpect(jsonPath("$.guardians", hasSize(1)))
                .andExpect(jsonPath("$.guardians[0].status").value("PENDING"))
                .andExpect(jsonPath("$.guardians[0].email").value("ana@example.com"))
                .andExpect(jsonPath("$.guardians[0].primaryContact").value(true))
                .andExpect(jsonPath("$.guardians[0].financialResponsible").value(true))
                .andExpect(jsonPath("$.guardians[0].inviteCode", matchesPattern("[A-Z2-9]{8}")))
                .andExpect(jsonPath("$.missingRequiredDocuments").value(2))
                .andReturn().getResponse().getContentAsString();
        long childId = ((Number) JsonPath.read(created, "$.userId")).longValue();
        long guardianshipId = ((Number) JsonPath.read(created, "$.guardians[0].id")).longValue();
        String guardianCode = JsonPath.read(created, "$.guardians[0].inviteCode");

        // The members list flags the child; the child gets the kids white belt.
        mockMvc.perform(get("/api/v1/crm/members").header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[?(@.userId == %d)].kid".formatted(childId)).value(true))
                .andExpect(jsonPath("$[?(@.userId == %d)].managed".formatted(childId)).value(true))
                .andExpect(jsonPath("$[?(@.userId == %d)].noGuardian".formatted(childId)).value(false))
                .andExpect(jsonPath("$[?(@.userId == %d)].missingDocuments".formatted(childId)).value(2))
                .andExpect(jsonPath("$[?(@.userId == %d)].belt.slug".formatted(childId)).value("kids-white"))
                .andExpect(jsonPath("$[?(@.userId == %d)].kid".formatted(instructor.userId())).value(false));

        // Documents: a current waiver, and a medical form signed 13 months ago (expired).
        String settings = mockMvc.perform(get("/api/v1/crm/kids/settings")
                .header("Authorization", bearer(owner.token())))
                .andReturn().getResponse().getContentAsString();
        long waiverId = ((Number) JsonPath.read(settings, "$.documentTypes[0].id")).longValue();
        long medicalId = ((Number) JsonPath.read(settings, "$.documentTypes[1].id")).longValue();
        recordDocument(instructor, childId, waiverId, LocalDate.now().minusDays(3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.missingRequiredDocuments").value(1));
        recordDocument(instructor, childId, medicalId, LocalDate.now().minusMonths(13))
                .andExpect(jsonPath("$.documents[1].status").value("EXPIRED"))
                .andExpect(jsonPath("$.missingRequiredDocuments").value(1));
        String renewed = recordDocument(instructor, childId, medicalId, LocalDate.now())
                .andExpect(jsonPath("$.documents[0].status").value("VALID"))
                .andExpect(jsonPath("$.documents[1].status").value("VALID"))
                .andExpect(jsonPath("$.documents[1].expiresOn").value(LocalDate.now().plusMonths(12).toString()))
                .andExpect(jsonPath("$.documents[2].status").value("MISSING"))
                .andExpect(jsonPath("$.missingRequiredDocuments").value(0))
                .andReturn().getResponse().getContentAsString();
        long renewedRecord = ((Number) JsonPath.read(renewed, "$.documents[1].recordId")).longValue();
        mockMvc.perform(delete("/api/v1/crm/kids/students/%d/documents/%d".formatted(childId, renewedRecord))
                .header("Authorization", bearer(instructor.token())))
                .andExpect(jsonPath("$.documents[1].status").value("EXPIRED"));

        // Pickup list, including someone who must not collect the child.
        mockMvc.perform(post("/api/v1/crm/kids/students/%d/pickups".formatted(childId))
                .header("Authorization", bearer(instructor.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Avó Rosa\", \"relationship\": \"Avó\", \"phone\": \"11 98888-0000\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/crm/kids/students/%d/pickups".formatted(childId))
                .header("Authorization", bearer(instructor.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Carlos Lima\", \"notes\": \"Ordem judicial\", \"blocked\": true}"))
                .andExpect(jsonPath("$.pickups", hasSize(2)))
                .andExpect(jsonPath("$.pickups[0].name").value("Carlos Lima"))
                .andExpect(jsonPath("$.pickups[0].blocked").value(true));

        // Emergency card.
        mockMvc.perform(put("/api/v1/crm/kids/students/%d/health".formatted(childId))
                .header("Authorization", bearer(instructor.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bloodType\": \"O+\", \"allergies\": \"Amendoim\", \"conditions\": \" \"}"))
                .andExpect(jsonPath("$.health.bloodType").value("O+"))
                .andExpect(jsonPath("$.health.allergies").value("Amendoim"))
                .andExpect(jsonPath("$.health.conditions").value(nullValue()))
                .andExpect(jsonPath("$.health.updatedByName").value("Kids Coach"));

        mockMvc.perform(get("/api/v1/crm/kids/settings").header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.checklist.kids").value(1))
                .andExpect(jsonPath("$.checklist.withoutGuardian").value(0))
                .andExpect(jsonPath("$.checklist.withMissingDocuments").value(1))
                .andExpect(jsonPath("$.checklist.withoutHealthInfo").value(0))
                .andExpect(jsonPath("$.checklist.withoutBirthDate").value(0));

        // The parent links their app account with the code; it works once.
        Account parent = register("kids-parent@bjjflow.com", "Ana Souza", 38);
        mockMvc.perform(post("/api/v1/guardians/me/claim")
                .header("Authorization", bearer(parent.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\": \"%s\"}".formatted(guardianCode.toLowerCase())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentUserId").value(childId))
                .andExpect(jsonPath("$.gymName").value("Kids Academy"))
                .andExpect(jsonPath("$.relationship").value("MOTHER"));
        mockMvc.perform(post("/api/v1/guardians/me/claim")
                .header("Authorization", bearer(parent.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\": \"%s\"}".formatted(guardianCode)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVITE_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/guardians/me/children").header("Authorization", bearer(parent.token())))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].displayName").value("Lia Souza"))
                .andExpect(jsonPath("$[0].age").value(8));
        mockMvc.perform(get("/api/v1/crm/kids/students/" + childId).header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.guardians[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.guardians[0].inviteCode").value(nullValue()))
                .andExpect(jsonPath("$.guardians[0].linkedAccountName").value("Ana Souza"));

        // A second guardian made the main contact takes it over from the first.
        String withFather = mockMvc.perform(post("/api/v1/crm/kids/students/%d/guardians".formatted(childId))
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Pedro Souza\", \"relationship\": \"FATHER\", \"primaryContact\": true}"))
                .andExpect(jsonPath("$.guardians", hasSize(2)))
                .andExpect(jsonPath("$.guardians[0].primaryContact").value(false))
                .andExpect(jsonPath("$.guardians[1].primaryContact").value(true))
                .andExpect(jsonPath("$.guardians[1].financialResponsible").value(false))
                .andReturn().getResponse().getContentAsString();
        long fatherId = ((Number) JsonPath.read(withFather, "$.guardians[1].id")).longValue();
        String fatherCode = JsonPath.read(withFather, "$.guardians[1].inviteCode");

        // Revoking ends access: the guardian disappears and the old code stops working.
        mockMvc.perform(delete("/api/v1/crm/kids/students/%d/guardians/%d".formatted(childId, fatherId))
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.guardians", hasSize(1)));
        mockMvc.perform(post("/api/v1/guardians/me/claim")
                .header("Authorization", bearer(parent.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\": \"%s\"}".formatted(fatherCode)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/crm/kids/students/%d/guardians/%d".formatted(childId, guardianshipId))
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.guardians", hasSize(0)));
        mockMvc.perform(get("/api/v1/guardians/me/children").header("Authorization", bearer(parent.token())))
                .andExpect(jsonPath("$", hasSize(0)));

        // Another gym cannot see this child.
        Account otherOwner = register("kids-other-owner@bjjflow.com", "Other Owner", 40);
        createGym(otherOwner, "Other Academy");
        mockMvc.perform(get("/api/v1/crm/kids/students/" + childId)
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    @Test
    void settingsAndChildrenAreValidated() throws Exception {
        Account owner = register("kids-rules-owner@bjjflow.com", "Rules Owner", 35);
        String inviteCode = createGym(owner, "Rules Academy");

        mockMvc.perform(put("/api/v1/crm/kids/settings")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"checkoutRequired": false, "pickupListOnly": false, "latePickupMinutes": 20,
                         "missingDocumentsPolicy": "BLOCK", "adultAge": 14,
                         "ageGroups": [{"name": "A", "minAge": 4, "maxAge": 8},
                                       {"name": "B", "minAge": 8, "maxAge": 12}]}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("OVERLAPPING_AGE_GROUPS"));
        mockMvc.perform(put("/api/v1/crm/kids/settings")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"checkoutRequired": false, "pickupListOnly": false, "latePickupMinutes": 20,
                         "missingDocumentsPolicy": "BLOCK", "adultAge": 14,
                         "ageGroups": [{"name": "Juvenil", "minAge": 9, "maxAge": 13},
                                       {"name": "Pequenos", "minAge": 4, "maxAge": 8}]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adultAge").value(14))
                .andExpect(jsonPath("$.missingDocumentsPolicy").value("BLOCK"))
                .andExpect(jsonPath("$.ageGroups[0].name").value("Pequenos"))
                .andExpect(jsonPath("$.documentTypes", hasSize(0)));

        // A 15-year-old is an adult for this gym, so it is not a child profile.
        mockMvc.perform(post("/api/v1/crm/kids/children")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\": \"Teen\", \"lastName\": \"Ager\", \"birthDate\": \"%s\"}"
                        .formatted(LocalDate.now().minusYears(15))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NOT_A_CHILD"));

        // A student with their own account: the gym may fill in the birth date, not the name.
        Account student = register("kids-rules-student@bjjflow.com", "Teen Student", 12);
        join(student, inviteCode);
        mockMvc.perform(get("/api/v1/crm/members").header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[?(@.userId == %d)].kid".formatted(student.userId())).value(true))
                .andExpect(jsonPath("$[?(@.userId == %d)].noGuardian".formatted(student.userId())).value(true));
        mockMvc.perform(put("/api/v1/crm/kids/students/%d/basics".formatted(student.userId()))
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\": \"Other\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_MANAGED"));
        LocalDate birthDate = LocalDate.now().minusYears(12).minusMonths(2);
        mockMvc.perform(put("/api/v1/crm/kids/students/%d/basics".formatted(student.userId()))
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"birthDate\": \"%s\"}".formatted(birthDate)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthDate").value(birthDate.toString()))
                .andExpect(jsonPath("$.ageGroup").value("Juvenil"))
                .andExpect(jsonPath("$.managed").value(false));
        mockMvc.perform(put("/api/v1/crm/kids/students/%d/basics".formatted(student.userId()))
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"birthDate\": \"%s\"}".formatted(birthDate.minusYears(1))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("BIRTH_DATE_SET_BY_STUDENT"));

        // Students cannot read family records.
        mockMvc.perform(get("/api/v1/crm/kids/students/" + student.userId())
                .header("Authorization", bearer(student.token())))
                .andExpect(status().isForbidden());
        // Nobody can be their own guardian.
        String family = mockMvc.perform(post("/api/v1/crm/kids/students/%d/guardians".formatted(student.userId()))
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Teen Student\", \"relationship\": \"OTHER\"}"))
                .andReturn().getResponse().getContentAsString();
        String code = JsonPath.read(family, "$.guardians[0].inviteCode");
        mockMvc.perform(post("/api/v1/guardians/me/claim")
                .header("Authorization", bearer(student.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\": \"%s\"}".formatted(code)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SELF_GUARDIAN"));
    }

    private ResultActions recordDocument(Account staff, long childId, long typeId, LocalDate signedOn)
            throws Exception {
        return mockMvc.perform(post("/api/v1/crm/kids/students/%d/documents".formatted(childId))
                .header("Authorization", bearer(staff.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"documentTypeId\": %d, \"signedByName\": \"Ana Souza\", \"signedOn\": \"%s\"}"
                        .formatted(typeId, signedOn)));
    }

    private String createGym(Account owner, String name) throws Exception {
        String gymJson = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"%s\"}".formatted(name)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(gymJson, "$.inviteCode");
    }

    private void join(Account account, String inviteCode) throws Exception {
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(account.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(inviteCode)))
                .andExpect(status().isOk());
    }

    private Account register(String email, String displayName, int age) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": %d, "beltSlug": "adult-white", "stripes": 0}
                        """.formatted(email, displayName, age)))
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
