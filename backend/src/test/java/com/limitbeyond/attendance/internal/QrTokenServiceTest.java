package com.limitbeyond.attendance.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.limitbeyond.attendance.domain.LocationQrSecret;
import com.limitbeyond.attendance.persistence.LocationQrSecretRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QrTokenServiceTest {

    @Mock
    private LocationQrSecretRepository repository;

    private QrTokenService service;
    private UUID locationId;

    @BeforeEach
    void setUp() {
        service = new QrTokenService(repository);
        locationId = UUID.randomUUID();
        byte[] secret = new byte[32];
        for (int i = 0; i < secret.length; i++) {
            secret[i] = (byte) (i + 1);
        }
        when(repository.findByLocationIdAndActiveTrue(locationId))
                .thenReturn(Optional.of(new LocationQrSecret(locationId, secret)));
    }

    @Test
    void issuesTheSamePrintableTokenForTheSameLocation() {
        assertThat(service.issue(locationId)).isEqualTo(service.issue(locationId));
    }

    @Test
    void verifiesOnlyForTheLocationTheTokenWasIssuedTo() {
        String token = service.issue(locationId);

        assertThat(service.verify(token, locationId)).isTrue();
        assertThat(service.verify(token, UUID.randomUUID())).isFalse();
        assertThat(service.verify("not-a-location-token", locationId)).isFalse();
    }
}
