package com.bjjflow.backend.config;

import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves locally-stored media under /media/**. Only registered when the local
 * storage provider is active; cloud providers serve their own URLs.
 */
@Configuration
@ConditionalOnProperty(name = "app.media.provider", havingValue = "local", matchIfMissing = true)
public class WebConfig implements WebMvcConfigurer {

    private final String mediaDir;

    public WebConfig(@Value("${app.media.local-dir:./data/media}") String mediaDir) {
        this.mediaDir = mediaDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = Paths.get(mediaDir).toAbsolutePath().normalize().toUri().toString();
        if (!location.endsWith("/")) {
            location = location + "/";
        }
        registry.addResourceHandler("/media/**").addResourceLocations(location);
    }
}
