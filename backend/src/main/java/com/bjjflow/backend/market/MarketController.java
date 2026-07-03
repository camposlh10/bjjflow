package com.bjjflow.backend.market;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.market.MarketService.CreateProductRequest;
import com.bjjflow.backend.market.MarketService.ProductDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/gyms/market")
@RequiredArgsConstructor
public class MarketController {

    private final MarketService marketService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping
    public List<ProductDto> list(Authentication auth) {
        return marketService.list(userId(auth));
    }

    @PostMapping
    public ProductDto create(Authentication auth, @Valid @RequestBody CreateProductRequest request) {
        return marketService.create(userId(auth), request);
    }

    @DeleteMapping("/{id}")
    public void delete(Authentication auth, @PathVariable Long id) {
        marketService.delete(userId(auth), id);
    }

    @PostMapping("/{id}/buy")
    public ProductDto buy(Authentication auth, @PathVariable Long id) {
        return marketService.buy(userId(auth), id);
    }
}
