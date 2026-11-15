package com.bjjflow.backend.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Public pages served by the backend (static files under resources/static),
 * at short addresses for App Store Connect and the apps.
 */
@Controller
public class PublicPagesController {

    /** Privacy policy (LGPD), linked from TestFlight / App Store Connect. */
    @GetMapping({ "/privacidade", "/privacy" })
    public String privacy() {
        return "forward:/privacidade.html";
    }
}
