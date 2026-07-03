package com.bjjflow.backend.techniques;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TechniqueRepository extends JpaRepository<Technique, Long> {

    List<Technique> findAllByOrderBySortOrderAscNamePtAsc();

    List<Technique> findByCategoryOrderBySortOrderAscNamePtAsc(String category);

    @Query("""
            SELECT t FROM Technique t
            WHERE LOWER(t.namePt) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(t.positionPt) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY t.sortOrder ASC, t.namePt ASC
            """)
    List<Technique> search(String q);

    @Query("SELECT t.category, COUNT(t) FROM Technique t GROUP BY t.category")
    List<Object[]> categoryCounts();
}
