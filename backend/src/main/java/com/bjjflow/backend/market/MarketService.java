package com.bjjflow.backend.market;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.storage.MediaStorage;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MarketService {

    public record ProductDto(Long id, String name, String description, int priceCents,
            String imageUrl, String link, long orderCount, boolean orderedByMe) {
    }

    public record CreateProductRequest(
            @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 120) String name,
            @jakarta.validation.constraints.Size(max = 500) String description,
            @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Min(0) Integer priceCents,
            String imageKey,
            @jakarta.validation.constraints.Size(max = 300) String link) {
    }

    private final GymProductRepository productRepository;
    private final GymOrderRepository orderRepository;
    private final GymMemberRepository gymMemberRepository;
    private final MediaStorage mediaStorage;

    @Transactional(readOnly = true)
    public List<ProductDto> list(Long userId) {
        GymMember membership = requireMembership(userId);
        List<GymProduct> products = productRepository
                .findAllByGymIdAndActiveTrueOrderByCreatedAtDesc(membership.getGymId());
        if (products.isEmpty()) {
            return List.of();
        }
        List<Long> ids = products.stream().map(GymProduct::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : orderRepository.countByProductIds(ids)) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        Set<Long> mine = new HashSet<>(orderRepository.orderedProductIds(userId, ids));
        return products.stream().map(p -> toDto(p, counts.getOrDefault(p.getId(), 0L), mine.contains(p.getId())))
                .toList();
    }

    @Transactional
    public ProductDto create(Long userId, CreateProductRequest req) {
        GymMember membership = requireStaff(userId);
        GymProduct p = new GymProduct();
        p.setGymId(membership.getGymId());
        p.setName(req.name().trim());
        p.setDescription(req.description() == null || req.description().isBlank() ? null : req.description().trim());
        p.setPriceCents(req.priceCents());
        p.setImageKey(req.imageKey());
        p.setLink(req.link() == null || req.link().isBlank() ? null : req.link().trim());
        p = productRepository.save(p);
        return toDto(p, 0, false);
    }

    @Transactional
    public void delete(Long userId, Long productId) {
        GymMember membership = requireStaff(userId);
        GymProduct p = productInGym(productId, membership.getGymId());
        p.setActive(false);
        productRepository.save(p);
    }

    @Transactional
    public ProductDto buy(Long userId, Long productId) {
        GymMember membership = requireMembership(userId);
        GymProduct p = productInGym(productId, membership.getGymId());
        GymOrder order = new GymOrder();
        order.setProductId(p.getId());
        order.setUserId(userId);
        orderRepository.save(order);
        return toDto(p, orderRepository.countByProductId(p.getId()), true);
    }

    private ProductDto toDto(GymProduct p, long orderCount, boolean orderedByMe) {
        return new ProductDto(p.getId(), p.getName(), p.getDescription(), p.getPriceCents(),
                p.getImageKey() == null ? null : mediaStorage.urlFor(p.getImageKey()),
                p.getLink(), orderCount, orderedByMe);
    }

    private GymProduct productInGym(Long productId, Long gymId) {
        GymProduct p = productRepository.findById(productId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Product not found"));
        if (!p.getGymId().equals(gymId) || !Boolean.TRUE.equals(p.getActive())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Product not found");
        }
        return p;
    }

    private GymMember requireMembership(Long userId) {
        return gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
    }

    private GymMember requireStaff(Long userId) {
        GymMember m = requireMembership(userId);
        if (m.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_STAFF", "Only instructors can do this");
        }
        return m;
    }
}
