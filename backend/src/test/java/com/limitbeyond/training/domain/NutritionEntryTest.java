package com.limitbeyond.training.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NutritionEntryTest {
    @Test
    void keepsNutrientSnapshotAndSupportsCoachEdits() {
        UUID member = UUID.randomUUID();
        UUID coach = UUID.randomUUID();
        NutritionEntry entry = new NutritionEntry(member, UUID.randomUUID(), coach,
                LocalDate.of(2026, 9, 24), NutritionEntry.MealType.LUNCH,
                "Paneer bowl", new BigDecimal("250"), "g", new BigDecimal("540"),
                new BigDecimal("32"), new BigDecimal("45"), new BigDecimal("26"),
                new BigDecimal("8"), 0, "MANUAL", null, "Home recipe");

        assertEquals(member, entry.getUserId());
        assertEquals(coach, entry.getCreatedByUserId());
        assertEquals(new BigDecimal("32"), entry.getProteinG());

        entry.update(LocalDate.of(2026, 9, 24), NutritionEntry.MealType.LUNCH,
                "Paneer bowl", new BigDecimal("300"), "g", new BigDecimal("648"),
                new BigDecimal("38.4"), new BigDecimal("54"), new BigDecimal("31.2"),
                new BigDecimal("9.6"), 0, "MANUAL", null, "Larger serving");

        assertEquals(new BigDecimal("300"), entry.getServingAmount());
        assertEquals(new BigDecimal("648"), entry.getCalories());
        assertEquals("Larger serving", entry.getNotes());
    }
}
