package com.limitbeyond.people.internal;

import com.limitbeyond.people.api.MemberFacade;
import com.limitbeyond.people.domain.MemberRecord;
import com.limitbeyond.people.persistence.MemberRecordRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class MemberFacadeImpl implements MemberFacade {

    private final MemberRecordRepository memberRecordRepository;

    MemberFacadeImpl(MemberRecordRepository memberRecordRepository) {
        this.memberRecordRepository = memberRecordRepository;
    }

    @Override
    @Transactional
    public void createIfAbsent(UUID userId, UUID gymId, UUID primaryLocationId) {
        if (memberRecordRepository.findByUserIdAndGymId(userId, gymId).isPresent()) {
            return;
        }
        memberRecordRepository.save(new MemberRecord(userId, gymId, primaryLocationId));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MemberSummary> findByUserAndGym(UUID userId, UUID gymId) {
        return memberRecordRepository.findByUserIdAndGymId(userId, gymId)
                .map(m -> new MemberSummary(m.getId(), m.getUserId(), m.getGymId(), m.getPrimaryLocationId()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MemberSummary> findById(UUID memberRecordId) {
        return memberRecordRepository.findById(memberRecordId)
                .map(m -> new MemberSummary(m.getId(), m.getUserId(), m.getGymId(), m.getPrimaryLocationId()));
    }
}
