package com.limitbeyond.shared.jobs;

import java.util.UUID;

record ClaimedJob(UUID id, String jobType, String payloadJson, int attempts) {
}
