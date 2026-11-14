package com.bjjflow.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MediaUploadTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private MediaStorage mediaStorage;

    private String token() throws Exception {
        String body = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "media@bjjflow.com", "password": "senha-forte-123",
                         "displayName": "Media Test", "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + JsonPath.read(body, "$.accessToken");
    }

    @Test
    void localStorageTellsTheClientToUseTheMultipartFallback() throws Exception {
        mockMvc.perform(post("/api/v1/media/uploads").header("Authorization", token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"contentType": "image/jpeg", "sizeBytes": 1024, "filename": "a.jpg"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direct").value(false))
                .andExpect(jsonPath("$.type").value("IMAGE"));
    }

    @Test
    void uploadRequestsAreValidated() throws Exception {
        String token = token();
        mockMvc.perform(post("/api/v1/media/uploads").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"contentType": "application/pdf", "sizeBytes": 1024}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA"));

        mockMvc.perform(post("/api/v1/media/uploads").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"contentType": "image/jpeg", "sizeBytes": 999999999}
                        """))
                .andExpect(status().is(413))
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));

        mockMvc.perform(post("/api/v1/media/uploads")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"contentType": "image/jpeg", "sizeBytes": 1024}
                        """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void multipartUploadStillWorksAndRoundTrips() throws Exception {
        byte[] content = "not-really-a-jpeg".getBytes();
        String body = mockMvc.perform(multipart("/api/v1/media")
                .file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", content))
                .header("Authorization", token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("IMAGE"))
                .andReturn().getResponse().getContentAsString();
        String key = JsonPath.read(body, "$.key");
        assertThat(key).endsWith(".jpg");
        assertThat(mediaStorage.read(key)).isEqualTo(content);
    }

    @Test
    void clientSuppliedFilenameCannotInjectIntoTheKey() {
        assertThat(MediaKeys.extensionFor(null, "evil.jpg/../../x")).isEmpty();
        assertThat(MediaKeys.extensionFor(null, "clip.MOV")).isEqualTo(".mov");
        assertThat(MediaKeys.extensionFor("image/png", "whatever.exe")).isEqualTo(".png");
    }

    /** Private bucket (Railway): stable app URLs, reads signed per request, virtual-host addressing. */
    @Test
    void s3PrivateBucketServesStableUrlsAndSignsReads() {
        S3MediaStorage s3 = new S3MediaStorage("https://t3.storageapi.dev", "auto", "bjjflow-media",
                "test-access-key", "test-secret-key", "", false);
        try {
            assertThat(s3.urlFor("posts/abc.jpg")).isEqualTo("/media/posts/abc.jpg");

            URI read = URI.create(s3.presignRead("posts/abc.jpg"));
            assertThat(read.getHost()).isEqualTo("bjjflow-media.t3.storageapi.dev");
            assertThat(read.getPath()).isEqualTo("/posts/abc.jpg");
            assertThat(read.getQuery()).contains("X-Amz-Signature=").contains("X-Amz-Expires=3600");

            var controller = new MediaReadController(s3);
            var ok = new org.springframework.mock.web.MockHttpServletRequest("GET", "/media/posts/abc.jpg");
            var response = controller.read(ok);
            assertThat(response.getStatusCode().value()).isEqualTo(302);
            assertThat(response.getHeaders().getLocation().getHost()).isEqualTo("bjjflow-media.t3.storageapi.dev");
            assertThat(response.getHeaders().getCacheControl()).contains("max-age=3000").contains("private");

            var traversal = new org.springframework.mock.web.MockHttpServletRequest("GET", "/media/posts/../secret");
            assertThat(controller.read(traversal).getStatusCode().value()).isEqualTo(404);
        } finally {
            s3.close();
        }
    }

    /** Signing is pure computation, so this needs no bucket or network. */
    @Test
    void s3PresignedUploadPinsKeyTypeAndSize() {
        S3MediaStorage s3 = new S3MediaStorage("https://account.r2.cloudflarestorage.com", "auto", "bjjflow-media",
                "test-access-key", "test-secret-key", "https://media.example.com/", true);
        try {
            var upload = s3.presignUpload("posts/abc.jpg", "image/jpeg", 2048).orElseThrow();

            URI url = URI.create(upload.uploadUrl());
            assertThat(url.getHost()).isEqualTo("account.r2.cloudflarestorage.com");
            assertThat(url.getPath()).isEqualTo("/bjjflow-media/posts/abc.jpg");
            assertThat(url.getQuery()).contains("X-Amz-Signature=").contains("X-Amz-Expires=600");
            // Type and size are signed, so the URL cannot upload something else.
            assertThat(url.getQuery()).contains("content-length").contains("content-type");
            // The client only has to echo the content type; nothing exotic.
            assertThat(upload.headers()).containsOnlyKeys("content-type");
            assertThat(upload.headers().get("content-type")).isEqualTo("image/jpeg");

            assertThat(s3.urlFor("posts/abc.jpg")).isEqualTo("https://media.example.com/posts/abc.jpg");
        } finally {
            s3.close();
        }
    }
}
