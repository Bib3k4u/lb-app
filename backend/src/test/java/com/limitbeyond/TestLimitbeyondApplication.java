package com.limitbeyond;

import org.springframework.boot.SpringApplication;

public class TestLimitbeyondApplication {

	public static void main(String[] args) {
		SpringApplication.from(LimitbeyondApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
