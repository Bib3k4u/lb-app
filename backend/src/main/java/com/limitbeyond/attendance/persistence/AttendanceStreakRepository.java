package com.limitbeyond.attendance.persistence;

import com.limitbeyond.attendance.domain.AttendanceStreak;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceStreakRepository extends JpaRepository<AttendanceStreak, UUID> {
    Optional<AttendanceStreak> findByUserIdAndGymId(UUID userId, UUID gymId);
}
