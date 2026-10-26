package com.limitbeyond.training.persistence;
import com.limitbeyond.training.domain.NutritionEntry;
import java.time.LocalDate; import java.util.List; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface NutritionEntryRepository extends JpaRepository<NutritionEntry,UUID>{List<NutritionEntry> findByUserIdAndLoggedOnOrderByCreatedAtAsc(UUID userId,LocalDate loggedOn);List<NutritionEntry> findByUserIdAndLoggedOnBetweenOrderByLoggedOnAscCreatedAtAsc(UUID userId,LocalDate start,LocalDate end);}
