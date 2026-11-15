package com.bjjflow.backend.config;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicPagesTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void privacyPolicyIsPublic() throws Exception {
        mockMvc.perform(get("/privacidade"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/privacidade.html"));
        mockMvc.perform(get("/privacy"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/privacidade.html"));
        mockMvc.perform(get("/privacidade.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("LGPD")));
        mockMvc.perform(get("/brand/bjjflow-icon-128.png"))
                .andExpect(status().isOk());
    }
}
