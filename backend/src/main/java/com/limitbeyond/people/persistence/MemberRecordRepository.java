package com.limitbeyond.people.persistence;

import com.limitbeyond.people.domain.MemberRecord;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRecordRepository extends JpaRepository<MemberRecord, UUID> {
    Optional<MemberRecord> findByUserIdAndGymId(UUID userId, UUID gymId);
}
