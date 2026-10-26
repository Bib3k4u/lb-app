package com.limitbeyond;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan // picks up the record-based *Properties classes under shared.config
@EnableScheduling // JobWorker's @Scheduled drain (ADR-09)
public class LimitbeyondApplication {

	public static void main(String[] args) {
		SpringApplication.run(LimitbeyondApplication.class, args);
	}

}
